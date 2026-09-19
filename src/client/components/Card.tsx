import React from 'react';
import { Card as CardType, Suit, Rank } from '../../shared/types';

interface Props {
  card: CardType;
  selected?: boolean;
  onClick?: () => void;
  small?: boolean;
  isHighlighted?: boolean;  // For new card highlight animation
}

const getSuitSymbol = (suit: Suit) => {
  switch (suit) {
    case Suit.Spades: return '♠';
    case Suit.Hearts: return '♥';
    case Suit.Clubs: return '♣';
    case Suit.Diamonds: return '♦';
    case Suit.Joker: return 'J'; // Special handling
  }
};

const getRankLabel = (rank: Rank) => {
  switch (rank) {
    case Rank.Two: return '2';
    case Rank.Three: return '3';
    case Rank.Four: return '4';
    case Rank.Five: return '5';
    case Rank.Six: return '6';
    case Rank.Seven: return '7';
    case Rank.Eight: return '8';
    case Rank.Nine: return '9';
    case Rank.Ten: return '10';
    case Rank.Jack: return 'J';
    case Rank.Queen: return 'Q';
    case Rank.King: return 'K';
    case Rank.Ace: return 'A';
    case Rank.SmallJoker: return 'Small Joker';
    case Rank.BigJoker: return 'Big Joker';
  }
};

export const Card: React.FC<Props> = ({ card, selected, onClick, small, isHighlighted }) => {
  const isRed = card.suit === Suit.Hearts || card.suit === Suit.Diamonds || card.rank === Rank.BigJoker;
  const isJoker = card.suit === Suit.Joker;
  
  const symbol = getSuitSymbol(card.suit);
  const label = isJoker ? (card.rank === Rank.BigJoker ? '大王' : '小王') : getRankLabel(card.rank);
  return <button type="button" disabled={!onClick} onClick={onClick}
    aria-label={`${label}${isJoker ? '' : symbol}${card.isWild ? ' 万能牌' : ''}`}
    aria-pressed={onClick ? !!selected : undefined}
    className={`playing-card ${small ? 'card-small' : ''} ${isRed ? 'card-red' : ''} ${selected ? 'card-selected' : ''} ${isHighlighted ? 'card-highlight' : ''} ${card.isWild ? 'card-wild' : ''}`}>
    <span className="card-corner"><strong>{label}</strong><span>{isJoker ? '✦' : symbol}</span></span>
    <span className="card-center" aria-hidden="true">{isJoker ? '✦' : symbol}</span>
    <span className="card-corner card-bottom" aria-hidden="true"><strong>{label}</strong><span>{isJoker ? '✦' : symbol}</span></span>
    {(card.isLevelCard || card.isWild) && <span className="card-level">{card.isWild ? '万能' : '级'}</span>}
  </button>;
};
