import React, { useState, useEffect } from 'react';
import backgroundImage from '../assets/guandan-background.jpg';
import { socket } from '../socket';
import { Card } from './Card';
import { Suit, Rank } from '../../shared/types';
interface Props { onJoin: (name: string, roomId: string, password: string) => void; onPreview: () => void; mobileMode: boolean; onToggleMobileMode: () => void; }
export const Lobby: React.FC<Props> = ({ onJoin, onPreview, mobileMode, onToggleMobileMode }) => {
 const [name,setName]=useState(''), [roomId,setRoomId]=useState(''), [password,setPassword]=useState('');
 const [connected,setConnected]=useState(socket.connected);
 useEffect(()=>{const on=()=>setConnected(true),off=()=>setConnected(false);socket.on('connect',on);socket.on('disconnect',off);return()=>{socket.off('connect',on);socket.off('disconnect',off)}},[]);
 return <main className="club-lobby" style={{backgroundImage:`linear-gradient(90deg,rgba(6,27,24,.96),rgba(6,27,24,.86)),url(${backgroundImage})`}}>
 <header className="club-header"><span className="club-mark">掼</span><span>老中医掼蛋房</span><button type="button" className="mobile-mode-switch" aria-pressed={mobileMode} onClick={onToggleMobileMode}>手机模式{mobileMode?' ✓':''}</button><span className="private-label">私人牌局</span></header>
 <section className="lobby-grid"><div className="lobby-intro"><p className="eyebrow">GUANDAN · PRIVATE TABLE</p><h1>好朋友，<br/>坐下来掼一局。</h1><p className="intro-copy">两副牌，四个人。<br/>熟悉的搭档，熟悉的默契。</p><div className="lobby-cards" aria-label="新版扑克牌展示">{[Rank.Ace,Rank.King,Rank.Queen,Rank.Jack].map((rank,i)=><Card key={rank} card={{id:String(i),rank,suit:i%2?Suit.Hearts:Suit.Spades}}/>)}</div><button className="text-button" onClick={onPreview}>先看看新版牌桌 ↗</button></div>
 <form className="join-panel" onSubmit={e=>{e.preventDefault();onJoin(name.trim(),roomId.trim(),password)}}><p className="eyebrow">INVITE ONLY</p><h2>入座，开一桌</h2><p className="panel-help">第一位玩家创建房间，朋友使用相同房间号和密码加入。</p>
 <label>玩家昵称<input value={name} onChange={e=>setName(e.target.value)} placeholder="朋友怎么称呼你？" autoComplete="nickname" maxLength={12} required/></label>
 <label>私人房间号<input value={roomId} onChange={e=>setRoomId(e.target.value)} placeholder="4–32 位字母、数字、下划线或短横线" minLength={4} maxLength={32} pattern="[A-Za-z0-9_-]+" required/></label>
 <label>房间密码<input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="输入约好的密码" minLength={4} maxLength={32} autoComplete="current-password" required/></label>
 <button className="gold-button" type="submit" disabled={!connected}>创建 / 加入私人房</button>
 <p className="connection-note" role="status">{connected?'已连接游戏服务':'正在连接游戏服务，首次唤醒可能需要约一分钟…'}</p><p className="privacy-note">房间不公开展示 · 仅凭房间号与密码加入</p><p className="install-note">手机浏览器菜单中选择“添加到主屏幕”，即可像 App 一样全屏使用。</p></form></section>
 <footer className="club-footer"><span>老中医掼蛋房</span><span>好友之间，牌桌见。</span></footer></main>
};
