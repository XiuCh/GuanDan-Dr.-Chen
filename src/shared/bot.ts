import { compareHands, getHandType, getLogicValue, sortCards } from './rules';
import { Card, Hand, HandType, Rank, Suit } from './types';

export interface BotContext {
  seatIndex?: number;
  lastPlayerIndex?: number;
  handCounts?: number[];
}

interface Candidate {
  cards: Card[];
  hand: Hand;
}

/** Medium-high bot that uses only its own cards and public table information. */
export class Bot {
  cards: Card[];
  level: number;
  context: BotContext;

  constructor(cards: Card[], level: number, context: BotContext = {}) {
    this.cards = sortCards(cards, level);
    this.level = level;
    this.context = context;
  }

  decideMove(target: Hand | null): Card[] | null {
    if (!this.cards.length) return null;
    const candidates = this.getCandidates();
    if (!candidates.length) return [this.cards[this.cards.length - 1]];

    if (!target) {
      return [...candidates].sort((a, b) => this.leadScore(a) - this.leadScore(b))[0].cards;
    }

    const playable = candidates.filter(candidate => compareHands(candidate.hand, target) > 0);
    if (!playable.length) return null;
    const finishingMove = playable.find(candidate => candidate.cards.length === this.cards.length);
    if (finishingMove) return finishingMove.cards;

    // Keep the lead in the team unless this bot can immediately finish.
    if (this.isPartner(this.context.lastPlayerIndex)) return null;

    const ordinary = playable.filter(candidate => !this.isBombFamily(candidate.hand));
    if (ordinary.length) return ordinary.sort((a, b) => this.followScore(a) - this.followScore(b))[0].cards;

    // Do not waste a bomb on an ordinary trick unless the endgame is urgent.
    if (!this.isBombFamily(target) && this.cards.length > 8 && this.lowestOpponentCount() > 3) return null;
    return playable.sort((a, b) => this.followScore(a) - this.followScore(b))[0].cards;
  }

  private getCandidates(): Candidate[] {
    const candidates: Candidate[] = [];
    const seen = new Set<string>();
    const wilds = this.cards.filter(card => card.isWild);
    const naturals = this.cards.filter(card => !card.isWild);

    const add = (cards: Card[]) => {
      const unique = Array.from(new Map(cards.map(card => [card.id, card])).values());
      if (!unique.length || unique.length !== cards.length) return;
      const hand = getHandType(unique, this.level);
      if (!hand) return;
      const key = unique.map(card => card.id).sort().join('|');
      if (seen.has(key)) return;
      seen.add(key);
      candidates.push({ cards: unique, hand });
    };

    add(this.cards);
    this.cards.forEach(card => add([card]));

    const valueGroups = new Map<number, Card[]>();
    naturals.forEach(card => {
      const value = getLogicValue(card.rank, this.level);
      valueGroups.set(value, [...(valueGroups.get(value) || []), card]);
    });

    // Pairs, trips, and bombs, using wild cards only when they complete a structure.
    valueGroups.forEach(group => {
      for (const size of [2, 3]) {
        if (group.length >= size) add(group.slice(0, size));
        else if (group.length + wilds.length >= size) add([...group, ...wilds.slice(0, size - group.length)]);
      }
      const maximum = Math.min(8, group.length + wilds.length);
      for (let size = 4; size <= maximum; size += 1) {
        const naturalCount = Math.min(group.length, size);
        add([...group.slice(0, naturalCount), ...wilds.slice(0, size - naturalCount)]);
      }
    });

    // Natural full houses preserve wild cards for more valuable uses.
    const groups = Array.from(valueGroups.entries());
    groups.forEach(([tripValue, tripCards]) => {
      if (tripCards.length < 3) return;
      groups.forEach(([pairValue, pairCards]) => {
        if (tripValue !== pairValue && pairCards.length >= 2) add([...tripCards.slice(0, 3), ...pairCards.slice(0, 2)]);
      });
    });

    // Straights and straight flushes; a wild card may fill a missing rank.
    const windows: number[][] = [[Rank.Ace, Rank.Two, Rank.Three, Rank.Four, Rank.Five]];
    for (let start = Rank.Two; start <= Rank.Ten; start += 1) {
      windows.push([start, start + 1, start + 2, start + 3, start + 4]);
    }
    const makeSequence = (ranks: number[], suit?: Suit) => {
      const selected: Card[] = [];
      for (const rank of ranks) {
        const card = naturals.find(item => item.rank === rank && (suit === undefined || item.suit === suit));
        if (card) selected.push(card);
      }
      const missing = 5 - selected.length;
      if (missing <= wilds.length) add([...selected, ...wilds.slice(0, missing)]);
    };
    windows.forEach(ranks => {
      makeSequence(ranks);
      [Suit.Spades, Suit.Hearts, Suit.Clubs, Suit.Diamonds].forEach(suit => makeSequence(ranks, suit));
    });

    // Three consecutive pairs (钢板) and two consecutive triples (木板).
    const rankGroups = new Map<number, Card[]>();
    naturals.filter(card => card.rank <= Rank.Ace).forEach(card => {
      rankGroups.set(card.rank, [...(rankGroups.get(card.rank) || []), card]);
    });
    const consecutiveWindows = (length: number) => {
      const result: number[][] = [[Rank.Ace, ...Array.from({ length: length - 1 }, (_, i) => Rank.Two + i)]];
      for (let start = Rank.Two; start <= Rank.Ace - length + 1; start += 1) {
        result.push(Array.from({ length }, (_, i) => start + i));
      }
      return result;
    };
    consecutiveWindows(3).forEach(ranks => {
      if (ranks.every(rank => (rankGroups.get(rank)?.length || 0) >= 2)) {
        add(ranks.flatMap(rank => rankGroups.get(rank)!.slice(0, 2)));
      }
    });
    consecutiveWindows(2).forEach(ranks => {
      if (ranks.every(rank => (rankGroups.get(rank)?.length || 0) >= 3)) {
        add(ranks.flatMap(rank => rankGroups.get(rank)!.slice(0, 3)));
      }
    });

    const smallJokers = this.cards.filter(card => card.rank === Rank.SmallJoker);
    const bigJokers = this.cards.filter(card => card.rank === Rank.BigJoker);
    if (smallJokers.length === 2 && bigJokers.length === 2) add([...smallJokers, ...bigJokers]);
    return candidates;
  }

  private leadScore(candidate: Candidate): number {
    if (candidate.cards.length === this.cards.length) return -100000;
    const remaining = this.cards.filter(card => !candidate.cards.some(used => used.id === card.id));
    let score = this.estimateTurns(remaining) * 100;
    score += this.structurePenalty(candidate) + candidate.hand.value;
    if (this.isBombFamily(candidate.hand)) score += 520;
    if ([HandType.Straight, HandType.TripsWithPair, HandType.Tube, HandType.Plate].includes(candidate.hand.type)) score -= 45;
    score -= candidate.cards.length * 8;
    return score;
  }

  private followScore(candidate: Candidate): number {
    let score = candidate.hand.value * 3 + this.structurePenalty(candidate);
    if (this.isBombFamily(candidate.hand)) score += 350 + candidate.cards.length * 25;
    score += candidate.cards.filter(card => card.isWild).length * 35;
    return score;
  }

  private structurePenalty(candidate: Candidate): number {
    if (this.isBombFamily(candidate.hand)) return 0;
    const sourceGroups = new Map<number, Card[]>();
    this.cards.forEach(card => {
      const value = getLogicValue(card.rank, this.level);
      sourceGroups.set(value, [...(sourceGroups.get(value) || []), card]);
    });
    let penalty = 0;
    sourceGroups.forEach(group => {
      const used = group.filter(card => candidate.cards.some(item => item.id === card.id)).length;
      if (!used) return;
      if (group.length >= 4 && used < group.length) penalty += 450;
      else if (group.length === 3 && used < 3) penalty += 45;
      else if (group.length === 2 && used === 1) penalty += 28;
    });
    penalty += candidate.cards.filter(card => card.isWild).length * 30;
    return penalty;
  }

  private estimateTurns(cards: Card[]): number {
    if (!cards.length) return 0;
    const counts = new Map<number, number>();
    cards.forEach(card => {
      const value = getLogicValue(card.rank, this.level);
      counts.set(value, (counts.get(value) || 0) + 1);
    });
    let trips = 0;
    let pairs = 0;
    let singles = 0;
    let bombs = 0;
    counts.forEach(count => {
      if (count >= 4) bombs += 1;
      else if (count === 3) trips += 1;
      else if (count === 2) pairs += 1;
      else singles += 1;
    });
    const fullHouses = Math.min(trips, pairs);
    return bombs + fullHouses + (trips - fullHouses) + (pairs - fullHouses) + singles;
  }

  private isBombFamily(hand: Hand): boolean {
    return hand.type === HandType.Bomb || hand.type === HandType.StraightFlush || hand.type === HandType.FourKings;
  }

  private isPartner(seat: number | undefined): boolean {
    return seat !== undefined && this.context.seatIndex !== undefined && seat !== this.context.seatIndex && seat % 2 === this.context.seatIndex % 2;
  }

  private lowestOpponentCount(): number {
    if (this.context.seatIndex === undefined || !this.context.handCounts) return Number.POSITIVE_INFINITY;
    const counts = this.context.handCounts.filter((count, seat) => seat % 2 !== this.context.seatIndex! % 2 && count > 0);
    return counts.length ? Math.min(...counts) : Number.POSITIVE_INFINITY;
  }
}
