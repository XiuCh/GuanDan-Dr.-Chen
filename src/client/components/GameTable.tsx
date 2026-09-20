import React, { useState, useEffect, useRef } from 'react';
import { Card as CardType, Rank, Suit, GameMode, SkillCard, SkillCardType, Hand } from '../../shared/types';
import { Bot } from '../../shared/bot';
import { Card } from './Card';
import { GameState, RoomState } from '../useGame';
import { compareHands, getLogicValue, isConsecutive, getAllPossibleHandTypes, getHandDescription } from '../../shared/rules';
import { SkillCardButton } from './SkillCardButton';
import { TargetSelectModal } from './TargetSelectModal';
import { GameHistory } from './GameHistory';

interface Props {
  gameState: GameState | null;
  roomState: RoomState;
  mySeat: number;
  onPlay: (cards: CardType[], handType?: Hand) => void;
  onPass: () => void;
  onReady: () => void;
  onStart: () => void;
  onTribute?: (cards: CardType[]) => void;
  onReturnTribute?: (cards: CardType[]) => void;
  chatMessages: {sender: string, text: string, time: string, seatIndex: number}[];
  onSendChat: (msg: string) => void;
  onSwitchSeat: (seatIdx: number) => void;
  onSetGameMode?: (mode: GameMode) => void;
  onUseSkill?: (skillId: string, targetSeat?: number) => void;
  onForceEndGame?: () => void;
  mobileMode: boolean;
  onToggleMobileMode: () => void;
}

export const GameTable: React.FC<Props> = ({ 
  gameState, roomState, mySeat, onPlay, onPass, onReady, onStart,
  onTribute, onReturnTribute, chatMessages, onSendChat, onSwitchSeat,
  onSetGameMode, onUseSkill, onForceEndGame, mobileMode, onToggleMobileMode
}) => {
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [viewMode, setViewMode] = useState<'normal' | 'stacked'>('stacked');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  
  // Common emojis for quick selection
  const quickEmojis = ['😀', '😂', '🤣', '😎', '🥳', '😭', '😡', '🤔', '👍', '👎', '❤️', '🔥', '💯', '🎉', '🤝', '✌️', '💪', '🙏', '😱', '🤯'];
  
  // Skill card state
  const [pendingSkill, setPendingSkill] = useState<SkillCard | null>(null);
  const [showTargetSelect, setShowTargetSelect] = useState(false);
  
  // New card highlight state
  const [highlightedCardIds, setHighlightedCardIds] = useState<Set<string>>(new Set());
  
  // Chat bubble state for each seat (seat -> message)
  const [chatBubbles, setChatBubbles] = useState<{ [seat: number]: string }>({});
  
  // History window state
  const [showHistory, setShowHistory] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showRoomMenu, setShowRoomMenu] = useState(false);
  const [hintMessage, setHintMessage] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const displayName = (name?: string) => name?.replace(/^Bot (\d+)$/, '电脑 $1') || '等待入座';
  const rankLabel = (rank: number) => ({11:'J',12:'Q',13:'K',14:'A'}[rank] || String(rank));
  const handLabel = (hand: Hand) => getHandDescription(hand, gameState?.level || 2);
  useEffect(() => { setHintMessage(''); setSelectedCardIds([]); setShowHandSelector(false); }, [gameState?.currentTurn, gameState?.phase]);
  useEffect(() => {
    const close = (e: KeyboardEvent) => { if (e.key === 'Escape') {setShowChat(false);setShowHistory(false);setShowRoomMenu(false);} };
    window.addEventListener('keydown', close); return () => window.removeEventListener('keydown', close);
  }, []);
  useEffect(() => {
    const syncFullscreen = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', syncFullscreen);
    return () => document.removeEventListener('fullscreenchange', syncFullscreen);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      } else {
        window.alert('iPhone Safari 请点“分享”，选择“添加到主屏幕”；以后从桌面打开即可隐藏地址栏。');
      }
    } catch {
      window.alert('浏览器没有允许全屏。iPhone 可点“分享”→“添加到主屏幕”，再从桌面打开。');
    }
  };

  
  // Hand type selection state (for wild cards with multiple interpretations)
  const [possibleHands, setPossibleHands] = useState<Hand[]>([]);
  const [showHandSelector, setShowHandSelector] = useState(false);
  
  // Track new cards and set up highlight timer
  useEffect(() => {
      if (gameState?.newCardIds && gameState.newCardIds.length > 0) {
          const newIds = new Set(gameState.newCardIds);
          setHighlightedCardIds(prev => new Set([...prev, ...newIds]));
          
          // Clear highlight after 3 seconds
          const timer = setTimeout(() => {
              setHighlightedCardIds(prev => {
                  const updated = new Set(prev);
                  gameState.newCardIds!.forEach(id => updated.delete(id));
                  return updated;
              });
          }, 3000);
          
          return () => clearTimeout(timer);
      }
  }, [gameState?.newCardIds]);
  
  // Track chat messages and show bubbles
  useEffect(() => {
      if (chatMessages.length > 0) {
          const lastMsg = chatMessages[chatMessages.length - 1];
          if (lastMsg.seatIndex !== undefined) {
              // Show bubble for this seat
              setChatBubbles(prev => ({
                  ...prev,
                  [lastMsg.seatIndex]: lastMsg.text
              }));
              
              // Clear bubble after 5 seconds
              const timer = setTimeout(() => {
                  setChatBubbles(prev => {
                      const updated = { ...prev };
                      delete updated[lastMsg.seatIndex];
                      return updated;
                  });
              }, 5000);
              
              return () => clearTimeout(timer);
          }
      }
  }, [chatMessages.length]);
  
  // Auto-scroll chat
  useEffect(() => {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const getPlayerAt = (offset: number) => {
    const seat = (mySeat + offset) % 4;
    const player = roomState.players.find(p => p && p.seatIndex === seat);
    const handCount = gameState ? (
      seat === mySeat 
        ? (gameState.hands[seat] as CardType[]).length 
        : (gameState.hands[seat] as number)
    ) : 0;
    
    // Team identification
    const isTeammate = (mySeat + 2) % 4 === seat;
    const isOpponent = !isTeammate && seat !== mySeat;
    
    return { player, handCount, seat, isTeammate, isOpponent };
  };

  const top = getPlayerAt(2);
  const left = getPlayerAt(3);
  const right = getPlayerAt(1);
  const me = getPlayerAt(0);

  const myHandOriginal = gameState ? (gameState.hands[mySeat] as CardType[]) : [];
  const handSignature = myHandOriginal.map(card => card.id).join('|');
  const [sortedHand, setSortedHand] = useState<CardType[]>([]);
  const [straightFlushIds, setStraightFlushIds] = useState<Set<string>>(new Set());

  useEffect(() => {
      if (myHandOriginal.length > 0 && gameState) {
          setSortedHand(myHandOriginal);
          
          // Detect Straight Flushes for Highlighting
          const sfSet = new Set<string>();
          // Logic: Group by Suit -> Sort by Rank -> Check consecutive 5+
          const suits = [Suit.Spades, Suit.Hearts, Suit.Clubs, Suit.Diamonds];
          
          suits.forEach(s => {
              const suitCards = myHandOriginal.filter(c => c.suit === s && !c.isWild && c.rank <= Rank.Ace);
              // Sort by Rank Ascending
              suitCards.sort((a, b) => a.rank - b.rank);
              
              // Find sequences
              let seq: CardType[] = [];
              for (let i = 0; i < suitCards.length; i++) {
                  if (seq.length === 0) {
                      seq.push(suitCards[i]);
                  } else {
                      const last = seq[seq.length - 1];
                      if (suitCards[i].rank === last.rank + 1) {
                          seq.push(suitCards[i]);
                      } else if (suitCards[i].rank === last.rank) {
                          // Duplicate rank? Skip or fork? 
                          // For visualization, just highlight one path or all?
                          // Simple: Reset sequence if gap
                          // Actually duplicates break strict sequence check if we just use prev.
                          // But if it is duplicate rank, we can still form SF if we have 5 unique ranks.
                          // Simplification: Check strict consecutive ranks.
                          // If gap > 1, reset.
                      } else {
                          // Gap
                          if (seq.length >= 5) {
                              seq.forEach(c => sfSet.add(c.id));
                          }
                          seq = [suitCards[i]];
                      }
                  }
              }
              if (seq.length >= 5) {
                  seq.forEach(c => sfSet.add(c.id));
              }
          });
          setStraightFlushIds(sfSet);

      } else {
          setSortedHand([]);
          setStraightFlushIds(new Set());
      }
  }, [handSignature, gameState?.level]);

  const toggleViewMode = () => {
      setViewMode(prev => prev === 'normal' ? 'stacked' : 'normal');
  };

  const toggleSelect = (id: string) => {
    setSelectedCardIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const selectedCards = sortedHand.filter(c => selectedCardIds.includes(c.id));
  const isMyTurn = !!gameState && gameState.phase === 'Playing' && gameState.currentTurn === mySeat;
  const targetHand = gameState?.lastHand && gameState.lastHand.playerIndex !== mySeat ? gameState.lastHand.hand : null;
  const validHands = gameState && selectedCards.length ? getAllPossibleHandTypes(selectedCards, gameState.level) : [];
  const playableHands = validHands.filter(hand => !targetHand || compareHands(hand, targetHand) > 0);
  const cannotPlay = !isMyTurn ? '请等待其他玩家出牌' : !selectedCards.length ? '请选择要出的牌' : !validHands.length ? '所选牌不能组成有效牌型' : !playableHands.length ? '所选牌压不过当前出牌，请重新选择或不出' : '';
  const handlePlay = () => {
    if (cannotPlay) return;
    if (playableHands.length > 1) {setPossibleHands(playableHands);setShowHandSelector(true);return;}
    onPlay(selectedCards, playableHands[0]); setSelectedCardIds([]);setHintMessage('');
  };

  const handleHandTypeSelect = (hand: Hand) => {
    const cards = sortedHand.filter(c => selectedCardIds.includes(c.id));
    onPlay(cards, hand);
    setSelectedCardIds([]);
    setShowHandSelector(false);
    setPossibleHands([]);
  };
  
  const handleHint = () => {
      if (!gameState) return;
      const bot = new Bot(sortedHand, gameState.level);
      const target = gameState.lastHand && gameState.lastHand.playerIndex !== mySeat ? gameState.lastHand.hand : null;
      const move = bot.decideMove(target);
      
      if (move) {
          setSelectedCardIds(move.map(c => c.id)); setHintMessage('已为你选好建议出的牌');
      } else {
          setSelectedCardIds([]); setHintMessage('没有可压过的牌，可以选择不出');
      }
  };
  
  const handleTributeAction = () => {
      const cards = sortedHand.filter(c => selectedCardIds.includes(c.id));
      if (cards.length !== 1) {
          alert("请选择一张牌");
          return;
      }
      if (gameState.phase === 'Tribute' && onTribute) onTribute(cards);
      if (gameState.phase === 'ReturnTribute' && onReturnTribute) onReturnTribute(cards);
      setSelectedCardIds([]);
  };
  
  const handleChatSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (chatInput.trim()) {
          onSendChat(chatInput.trim());
          setChatInput('');
      }
  }
  
  // Skill card handlers
  const handleSkillClick = (skill: SkillCard) => {
      const needsTarget = [SkillCardType.Steal, SkillCardType.Discard, SkillCardType.Skip];
      if (needsTarget.includes(skill.type)) {
          setPendingSkill(skill);
          setShowTargetSelect(true);
      } else {
          // No target needed, use immediately
          onUseSkill?.(skill.id);
      }
  };
  
  const handleTargetSelect = (targetSeat: number) => {
      if (pendingSkill) {
          onUseSkill?.(pendingSkill.id, targetSeat);
          setPendingSkill(null);
          setShowTargetSelect(false);
      }
  };
  
  const handleTargetCancel = () => {
      setPendingSkill(null);
      setShowTargetSelect(false);
  };
  
  // Get players for target selection
  const getPlayersForTargeting = () => {
      return roomState.players
          .filter((p): p is NonNullable<typeof p> => p !== null)
          .map(p => ({
              name: p.name,
              seatIndex: p.seatIndex,
              handCount: gameState 
                  ? (typeof gameState.hands[p.seatIndex] === 'number' 
                      ? gameState.hands[p.seatIndex] as number 
                      : (gameState.hands[p.seatIndex] as CardType[]).length)
                  : 0
          }));
  };

  const isTributePhase = gameState && (gameState.phase === 'Tribute' || gameState.phase === 'ReturnTribute');
  const amIPaying = isTributePhase && gameState.tributeState && (
      (gameState.phase === 'Tribute' && gameState.tributeState.pendingTributes.some((t: any) => t.from === mySeat)) ||
      (gameState.phase === 'ReturnTribute' && gameState.tributeState.pendingReturns.some((t: any) => t.from === mySeat))
  );

  const renderLastHand = () => {
    if (!gameState || !gameState.lastHand) return null;
    const { playerIndex, hand } = gameState.lastHand;
    const playerName = roomState.players.find(p => p && p.seatIndex === playerIndex)?.name || `座位 ${playerIndex + 1}`;
    
    return (
      <div className="last-play">
        <div className="text-white mb-2 font-bold">{displayName(playerName)} 出牌</div>
        <div className="last-play-cards">
           {hand.cards.map((c: CardType) => (
             <Card key={c.id} card={c} />
           ))}
        </div>
        <div className="text-yellow-300 font-bold mt-2">{handLabel(hand)}</div>
      </div>
    );
  };

  // Helper to render cards played in round action
  const renderActionCards = (cards: CardType[] | undefined) => {
      if (!cards || cards.length === 0) return null;
      return (
          <div className="flex gap-0.5 mt-1">
              {cards.slice(0, 6).map((card, i) => (
                  <div key={i} className="w-6 h-8 bg-white rounded text-xs flex items-center justify-center font-bold border border-gray-300"
                       style={{ color: (card.suit === Suit.Hearts || card.suit === Suit.Diamonds) ? 'red' : 'black' }}>
                      {card.rank === Rank.SmallJoker ? '🃏' : card.rank === Rank.BigJoker ? '🃟' : 
                       ['', '', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'][card.rank] || '?'}
                  </div>
              ))}
              {cards.length > 6 && <span className="text-white text-xs">+{cards.length - 6}</span>}
          </div>
      );
  };

  const PlayerArea = ({ data, pos }: { data: any, pos: string }) => {
    const action = gameState?.roundActions?.[data.seat];
    const bubble = chatBubbles[data.seat];
    
    // Get winner position (头游、二游、三游、末游)
    const getWinnerPosition = () => {
      if (!gameState || !gameState.winners) return null;
      const position = gameState.winners.indexOf(data.seat);
      if (position === -1) return null;
      const labels = ['头游', '二游', '三游', '末游'];
      const colors = ['bg-yellow-500', 'bg-orange-500', 'bg-purple-500', 'bg-gray-500'];
      return { label: labels[position], color: colors[position] };
    };
    
    const winnerPos = getWinnerPosition();
    
    return (
      <div 
          className={`player-seat ${gameState?.phase === 'Playing' && gameState.currentTurn === data.seat ? 'seat-active' : ''} absolute ${pos} flex flex-col items-center p-4 rounded-lg transition-colors ${data.isTeammate ? 'bg-blue-900/40 border-2 border-blue-400' : 'bg-black/20'} ${!gameState && !data.player ? 'cursor-pointer hover:bg-white/10' : ''}`}
          onClick={() => !gameState && !data.player && onSwitchSeat(data.seat)}
      >
         {/* Chat Bubble */}
         {bubble && (
           <div className="absolute -top-16 left-1/2 -translate-x-1/2 z-50 animate-bounce-in">
             <div className="relative bg-white text-gray-800 px-4 py-2 rounded-xl shadow-lg max-w-48 text-sm font-medium whitespace-pre-wrap">
               {bubble}
               {/* Bubble arrow */}
               <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent border-t-white"></div>
             </div>
           </div>
         )}
         
         <div className="w-12 h-12 bg-gray-300 rounded-full flex items-center justify-center mb-2 relative">
           {data.player ? data.player.name[0].toUpperCase() : (gameState ? '?' : '+')}
           {data.isTeammate && <div className="absolute -top-1 -right-1 bg-blue-500 text-xs text-white px-1 rounded">搭档</div>}
           {data.isOpponent && <div className="absolute -top-1 -right-1 bg-red-500 text-xs text-white px-1 rounded">对方</div>}
           {data.player && data.player.seatIndex === 0 && (
               <div className="absolute -bottom-1 -right-1 text-xs bg-yellow-500 text-black px-1 rounded font-bold border border-white">
                   房主
               </div>
           )}
           {/* Winner Position Badge */}
           {winnerPos && (
               <div className={`absolute -top-2 left-1/2 -translate-x-1/2 ${winnerPos.color} text-white text-xs px-2 py-0.5 rounded-full font-bold shadow-lg border-2 border-white animate-pulse`}>
                   {winnerPos.label}
               </div>
           )}
         </div>
         <div className="text-white font-bold flex items-center gap-2">
             {data.player ? displayName(data.player.name) : '点击入座'}
             {data.player && (data.player as any).isDisconnected && (
                 <span className="text-red-500 text-xs font-bold bg-white px-1 rounded animate-pulse">离线</span>
             )}
         </div>
         {!gameState && data.player && (
             <div className={`seat-status ${data.player.isReady ? 'is-ready' : ''}`}>
               {data.seat === mySeat ? '我的座位' : data.isTeammate ? '你的搭档' : '对方座位'} · {data.player.isReady ? '已准备' : '未准备'}
             </div>
         )}
         {gameState && <div className="text-yellow-400">剩余 {data.handCount} 张</div>}
         
         {/* Show current round action */}
         {gameState && action && (
             <div className="mt-2 flex flex-col items-center">
                 {action.type === 'pass' ? (
                     <div className="text-gray-400 font-bold text-sm bg-gray-700/50 px-3 py-1 rounded">不出</div>
                 ) : (
                     <div className="flex flex-col items-center">
                         <div className="text-green-400 text-xs mb-1">{action.hand ? handLabel(action.hand) : '出牌'}</div>
                         {renderActionCards(action.cards)}
                     </div>
                 )}
             </div>
         )}
         
         {gameState?.phase === 'Playing' && gameState.currentTurn === data.seat && (
             <div className="animate-bounce text-red-500 font-bold mt-2">正在出牌</div>
         )}
      </div>
    );
  };

  const getStackedMatrix = () => {
      if (!gameState) return [];
      const groups = new Map<number, CardType[]>();
      sortedHand.forEach(card => groups.set(card.rank, [...(groups.get(card.rank) || []), card]));
      return Array.from(groups.entries())
        .sort(([rankA], [rankB]) => getLogicValue(rankB, gameState.level) - getLogicValue(rankA, gameState.level))
        .map(([rank, cards]) => ({
          rank,
          cards: cards.sort((a, b) => a.suit - b.suit || Number(b.isWild) - Number(a.isWild))
        }));
  };

  const stackedColumns = getStackedMatrix();

  return (
    <div className={`game-table relative w-full h-screen overflow-hidden flex items-center justify-center ${mobileMode ? 'mobile-layout' : ''}`}>
      <div className="absolute inset-20 border-2 border-[#333333] rounded-xl opacity-50 pointer-events-none"></div>

      <PlayerArea data={top} pos="top-4 left-1/2 -translate-x-1/2" />
      <PlayerArea data={left} pos="left-8 top-1/2 -translate-y-1/2" />
      <PlayerArea data={right} pos="right-8 top-1/2 -translate-y-1/2" />
      
      <nav className="table-tools" aria-label="房间工具">
        <button className="fullscreen-action" aria-pressed={isFullscreen} onClick={toggleFullscreen}>{isFullscreen ? '退出全屏' : '全屏'}</button>
        <button aria-pressed={mobileMode} onClick={onToggleMobileMode}><span className="tool-label-wide">手机模式{mobileMode?' ✓':''}</span><span className="tool-label-short">手机{mobileMode?' ✓':''}</span></button>
        <button aria-expanded={showChat} onClick={() => {setShowChat(!showChat);setShowHistory(false);setShowRoomMenu(false);}}>聊天</button>
        <button aria-expanded={showHistory} onClick={() => {setShowHistory(!showHistory);setShowChat(false);setShowRoomMenu(false);}}><span className="tool-label-wide">历史记录</span><span className="tool-label-short">记录</span></button>
        <button aria-expanded={showRoomMenu} onClick={() => {setShowRoomMenu(!showRoomMenu);setShowChat(false);setShowHistory(false);}}><span className="tool-label-wide">房间菜单</span><span className="tool-label-short">菜单</span></button>
      </nav>
      {mobileMode && <div className="rotate-tip" role="status">横屏玩，牌面更清楚</div>}
      {showRoomMenu && <section className="room-menu" aria-label="房间菜单">
        <strong>房间 {roomState.roomId}</strong><p>房间凭密码加入</p>
        {mySeat === 0 && gameState && <button className="danger-action" onClick={() => {if(window.confirm('确定结束当前对局？本场进度将丢失，所有玩家返回等待区。')){onForceEndGame?.();setShowRoomMenu(false);}}}>结束当前对局</button>}
        <button onClick={() => setShowRoomMenu(false)}>关闭菜单</button>
      </section>}
      {showChat && <>
      {/* Chat Box */}
      <div className="table-chat absolute top-4 right-4 w-72 h-56 bg-[#252526] border border-[#333333] rounded flex flex-col pointer-events-auto z-10 shadow-lg">
          <div className="chat-heading"><strong>房间聊天</strong><button aria-label="关闭聊天" onClick={() => setShowChat(false)}>×</button></div>
          <div className="flex-1 overflow-y-auto p-2 text-sm text-[#d4d4d4] scrollbar-thin">
              {chatMessages.map((msg, i) => (
                  <div key={i} className="mb-1">
                      <span className="text-[#858585] text-xs">[{msg.time}] </span>
                      <span className="font-bold text-[#569cd6]">{msg.sender}: </span>
                      <span className="break-words">{msg.text}</span>
                  </div>
              ))}
              <div ref={chatEndRef} />
          </div>
          
          {/* Emoji Picker */}
          {showEmojiPicker && (
              <div className="p-2 border-t border-[#333333] bg-[#1e1e1e] grid grid-cols-10 gap-1">
                  {quickEmojis.map((emoji, i) => (
                      <button 
                          key={i} 
                          type="button"
                          onClick={() => {
                              setChatInput(prev => prev + emoji);
                              setShowEmojiPicker(false);
                          }}
                          className="text-lg hover:bg-[#3c3c3c] rounded p-1 transition-colors"
                      >
                          {emoji}
                      </button>
                  ))}
              </div>
          )}
          
          <form onSubmit={handleChatSubmit} className="p-2 border-t border-[#333333] flex items-center gap-1">
              <button 
                  type="button" 
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className="text-lg hover:bg-[#3c3c3c] rounded p-1"
                  title="表情"
              >
                  😊
              </button>
              <input 
                  className="flex-1 bg-[#3c3c3c] border-none text-white text-sm focus:outline-none rounded px-2 py-1" 
                  aria-label="聊天消息" placeholder="输入消息..." 
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
              />
              <button type="submit" className="text-[#0e639c] font-bold text-sm hover:text-[#1177bb]">发送</button>
          </form>
      </div>

      </>}
      <div className="table-level"><span>本局打 <b>{rankLabel(gameState?.level || 2)}</b></span><small>房间 {roomState.roomId}</small></div>
      <div className="center-play absolute left-1/2 -translate-x-1/2 -translate-y-1/2">
        {renderLastHand()}
        {!gameState && (
            <section className="waiting-panel" aria-labelledby="waiting-title">
               <div className="waiting-kicker">私人牌局 · {roomState.players.filter(Boolean).length}/4 人已入座</div>
               <h1 id="waiting-title">等朋友到齐，就开局</h1>
               <p className="waiting-copy">把房间号和密码发给朋友。朋友未到齐也可以开局，空位由电脑补齐。</p>
               <div className="room-code-row">
                 <span>房间号</span><strong>{roomState.roomId}</strong>
               </div>
               <div className="waiting-mode" aria-label="选择游戏模式">
                   <span>玩法</span>
                   <button 
                       onClick={() => onSetGameMode?.(GameMode.Normal)}
                       disabled={mySeat !== 0}
                       aria-pressed={roomState.gameMode !== GameMode.Skill}
                       className={`mode-choice ${
                           roomState.gameMode !== GameMode.Skill 
                               ? 'mode-selected' : ''
                       }`}
                   >
                       经典掼蛋
                   </button>
                   <button 
                       onClick={() => onSetGameMode?.(GameMode.Skill)}
                       disabled={mySeat !== 0}
                       aria-pressed={roomState.gameMode === GameMode.Skill}
                       className={`mode-choice ${
                           roomState.gameMode === GameMode.Skill 
                               ? 'mode-selected' : ''
                       }`}
                   >
                       技能掼蛋
                   </button>
               </div>
               {roomState.gameMode === GameMode.Skill && (
                   <p className="mode-note">技能玩法：每人开局获得两张技能卡</p>
               )}
               <div className="waiting-actions">
                 {me.player && !me.player.isReady ? (
                   <button onClick={onReady} className="ready-action">我准备好了</button>
                 ) : (
                   <span className="ready-state">✓ 你已准备</span>
                 )}
                 {me.player?.seatIndex === 0 ? (
                   <button onClick={onStart} className="start-action">房主开局</button>
                 ) : (
                   <span className="host-state">等待房主开始</span>
                 )}
               </div>
               <p className="seat-hint">空座位可点击换座 · “搭档”坐在你的对面 · 电脑难度：中高</p>
            </section>
        )}
      </div>

      <div className="hand-dock absolute bottom-0 w-full flex flex-col items-center pb-4 z-20 pointer-events-none">
        {gameState && <div className={`turn-banner ${isMyTurn ? 'your-turn' : ''}`} role="status">
          {gameState.phase === 'Playing' ? (isMyTurn ? '轮到你出牌' : `等待${displayName(roomState.players[gameState.currentTurn]?.name)}出牌`) : gameState.phase === 'Tribute' ? '进贡阶段' : gameState.phase === 'ReturnTribute' ? '还贡阶段' : '本局结算'}
        </div>}
        {/* Skill Cards Area */}
        {gameState && gameState.gameMode === GameMode.Skill && gameState.mySkillCards && gameState.mySkillCards.length > 0 && (
            <div className="mb-4 pointer-events-auto flex flex-col items-center">
                <div className="text-purple-400 text-sm mb-2 font-bold">我的技能卡</div>
                <div className="flex gap-3">
                    {gameState.mySkillCards.map((skill) => (
                        <SkillCardButton 
                            key={skill.id} 
                            skill={skill} 
                            onClick={() => handleSkillClick(skill)}
                            disabled={gameState.currentTurn !== mySeat || gameState.phase !== 'Playing'}
                        />
                    ))}
                </div>
                {gameState.currentTurn === mySeat && gameState.phase === 'Playing' && (
                    <div className="text-xs text-gray-400 mt-1">点击技能卡使用（使用后仍可出牌）</div>
                )}
            </div>
        )}

        <div className="controls-container pointer-events-auto">
            {gameState?.phase === 'Playing' && <>
              <div className="action-row">
                <button onClick={toggleViewMode}>{viewMode === 'normal' ? '同点叠放' : '展开排列'}</button>
                <button onClick={() => {setSelectedCardIds([]);setHintMessage('');}} disabled={!selectedCardIds.length}>取消选择</button>
                <button onClick={handleHint} disabled={!isMyTurn}>提示</button>
                <button className="primary-play" onClick={handlePlay} disabled={!!cannotPlay} aria-describedby="play-feedback">出牌{selectedCardIds.length ? `（${selectedCardIds.length}）` : ''}</button>
                <button onClick={onPass} disabled={!isMyTurn || !targetHand} title={!targetHand ? '你领出本轮，必须出牌' : '本轮不出'}>不出</button>
              </div>
              <p id="play-feedback" className="play-feedback" aria-live="polite">{hintMessage || cannotPlay || `已选 ${selectedCardIds.length} 张 · ${playableHands.map(handLabel).join(' / ')}`}{isMyTurn && !targetHand ? ' · 本轮由你领出' : ''}</p>
            </>}
            {amIPaying && (
                <div className="flex gap-4">
                   <div className="text-yellow-400 font-bold text-xl animate-pulse">
                       {gameState!.phase === 'Tribute' ? '请进贡最大牌' : '请还贡一张牌'}
                   </div>
                   <button 
                      onClick={handleTributeAction} 
                      className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-2 rounded-full font-bold shadow-lg"
                   >
                      确认
                   </button>
                </div>
            )}
        </div>

        {/* Hand Area - Compact Grid */}
        <div style={{"--hand-gaps": Math.max(1, sortedHand.length - 1), "--rank-gaps": Math.max(1, stackedColumns.length - 1)} as React.CSSProperties} className={`live-hand px-8 flex items-end justify-center pointer-events-auto transition-all duration-300 ${viewMode === 'normal' ? 'hand-normal' : 'hand-stacked'}`}>
          {viewMode === 'normal' ? (
              // Normal View
              sortedHand.map((card: CardType) => (
                <Card 
                  key={card.id} 
                  card={card} 
                  selected={selectedCardIds.includes(card.id)}
                  onClick={() => toggleSelect(card.id)}
                  isHighlighted={highlightedCardIds.has(card.id)}
                />
              ))
          ) : (
              // Stacked Matrix View (Compact columns)
              stackedColumns.map((col) => (
                  <div key={col.rank} className={`rank-stack ${mobileMode ? 'mobile-rank-group' : ''}`} style={{'--stack-count': col.cards.length} as React.CSSProperties} aria-label={`${rankLabel(col.rank)}，${col.cards.length} 张`}>
                      {mobileMode && <strong className="rank-group-label">{rankLabel(col.rank)}<small>×{col.cards.length}</small></strong>}
                      <div className={mobileMode ? 'rank-suit-grid' : 'rank-layer-list'}>
                        {col.cards.map((card, idx) => (
                          <div
                            key={card.id}
                            className={`rank-card-layer ${straightFlushIds.has(card.id) ? 'straight-flush-card ring-2 ring-yellow-400 rounded' : ''}`}
                            style={{ "--stack-index": idx, zIndex: idx + 1 } as React.CSSProperties}
                          >
                            <Card
                              card={card}
                              selected={selectedCardIds.includes(card.id)}
                              onClick={() => toggleSelect(card.id)}
                              isHighlighted={highlightedCardIds.has(card.id)}
                            />
                          </div>
                        ))}
                      </div>
                  </div>
              ))
          )}
        </div>
        <div className="relative">
          {/* My Chat Bubble */}
          {chatBubbles[mySeat] && (
            <div className="absolute -top-12 left-1/2 -translate-x-1/2 z-50 animate-bounce-in">
              <div className="relative bg-white text-gray-800 px-4 py-2 rounded-xl shadow-lg max-w-48 text-sm font-medium whitespace-pre-wrap">
                {chatBubbles[mySeat]}
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent border-t-white"></div>
              </div>
            </div>
          )}
          <div className="text-white font-bold mt-2">{displayName(me.player?.name)} （我）</div>
        </div>
      </div>
      
      {gameState && gameState.phase === 'Score' && (
          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center text-white z-50">
              <h1 className="text-6xl font-bold mb-8 text-yellow-400">本局结束</h1>
              <div className="text-2xl mb-4">
                  获胜顺序: {gameState.winners.map(w => {
                      const p = roomState.players.find(pl => pl && pl.seatIndex === w);
                      return p ? displayName(p.name) : `座位 ${w + 1}`;
                  }).join(' → ')}
              </div>
              {gameState.teamLevels && (
                  <div className="text-xl text-gray-300 mb-4">
                      当前等级 - 队伍0: {gameState.teamLevels[0]} | 队伍1: {gameState.teamLevels[1]}
                  </div>
              )}
              <div className="text-lg text-yellow-300 animate-pulse">
                  ⏳ 3秒后自动开始下一局...
              </div>
              <div className="text-sm text-gray-400 mt-4">
                  (对局将持续到某队打到A并连胜两次)
              </div>
          </div>
      )}
      
      {/* Hand Type Selection Modal (for wild cards) */}
      {showHandSelector && possibleHands.length > 0 && gameState && (
          <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-50">
              <div className="bg-[#252526] border border-[#333333] rounded-lg p-6 max-w-md shadow-2xl">
                  <h2 className="text-2xl font-bold text-[#9cdcfe] mb-4">选择牌型</h2>
                  <p className="text-gray-400 mb-4">您的牌包含红心{gameState.level}（万能牌），可以组成以下牌型：</p>
                  <div className="flex flex-col gap-3">
                      {possibleHands.map((hand, idx) => (
                          <button
                              key={idx}
                              onClick={() => handleHandTypeSelect(hand)}
                              className="bg-[#3c3c3c] hover:bg-[#4c4c4c] text-white px-6 py-3 rounded-lg font-bold transition-colors text-left"
                          >
                              <div className="text-lg">{getHandDescription(hand, gameState.level)}</div>
                              <div className="text-sm text-gray-400 mt-1">
                                  {handLabel(hand)}
                                  {hand.bombCount && ` (${hand.bombCount}张炸弹)`}
                              </div>
                          </button>
                      ))}
                  </div>
                  <button
                      onClick={() => {
                          setShowHandSelector(false);
                          setPossibleHands([]);
                      }}
                      className="mt-4 w-full bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg"
                  >
                      取消
                  </button>
              </div>
          </div>
      )}
      
      {/* Target Selection Modal for Skills */}
      {showTargetSelect && pendingSkill && (
          <TargetSelectModal
              skillType={pendingSkill.type}
              players={getPlayersForTargeting()}
              mySeat={mySeat}
              onSelect={handleTargetSelect}
              onCancel={handleTargetCancel}
          />
      )}
      
      {/* Game History Window */}
      {showHistory && (
          <GameHistory
              history={gameState?.history || []}
              currentRound={gameState?.currentRound || 1}
              isOpen={showHistory}
              onClose={() => setShowHistory(false)}
          />
      )}
      

    </div>
  );
};
