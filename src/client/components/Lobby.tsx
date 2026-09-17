import React, { useState } from 'react';
import backgroundImage from '../assets/guandan-background.jpg';

interface Props {
  onJoin: (name: string, roomId: string, password: string) => void;
}

export const Lobby: React.FC<Props> = ({ onJoin }) => {
  const [name, setName] = useState('');
  const [roomId, setRoomId] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onJoin(name.trim(), roomId.trim(), password);
  };

  return (
    <main
      className="relative flex min-h-[100dvh] flex-col items-center justify-center bg-cover bg-center px-4 py-8 text-gray-200"
      style={{
        backgroundImage: `linear-gradient(rgba(10, 8, 5, 0.58), rgba(10, 8, 5, 0.78)), url(${backgroundImage})`
      }}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/35" aria-hidden="true" />

      <h1 className="relative z-10 mb-3 text-center font-serif text-3xl font-bold tracking-[0.12em] text-[#f1d5a3] drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] sm:text-5xl">
        老中医掼蛋房
      </h1>
      <p className="relative z-10 mb-7 max-w-sm text-center text-sm leading-6 text-gray-100 drop-shadow-[0_1px_3px_rgba(0,0,0,1)]">
        第一位玩家使用房间号和密码创建房间，其他三位玩家使用相同信息加入。
      </p>

      <form
        onSubmit={handleSubmit}
        className="relative z-10 flex w-full max-w-sm flex-col gap-5 rounded-xl border border-[#c49a62]/40 bg-[#17130f]/90 p-6 shadow-2xl backdrop-blur-sm sm:p-8"
      >
        <div>
          <label className="mb-2 block text-sm font-bold text-[#d9ad75]" htmlFor="player-name">
            玩家昵称
          </label>
          <input
            id="player-name"
            type="text"
            value={name}
            onChange={event => setName(event.target.value)}
            className="w-full rounded border border-[#6f5942] bg-black/55 p-3 text-base text-white placeholder:text-gray-400 focus:border-[#d9ad75] focus:outline-none"
            placeholder="请输入昵称"
            autoComplete="nickname"
            maxLength={12}
            required
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-bold text-[#d9ad75]" htmlFor="room-id">
            私人房间号
          </label>
          <input
            id="room-id"
            type="text"
            value={roomId}
            onChange={event => setRoomId(event.target.value)}
            className="w-full rounded border border-[#6f5942] bg-black/55 p-3 text-base text-white placeholder:text-gray-400 focus:border-[#d9ad75] focus:outline-none"
            placeholder="例如 GD9284X7"
            autoCapitalize="characters"
            autoCorrect="off"
            minLength={4}
            maxLength={32}
            pattern="[A-Za-z0-9_-]+"
            required
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-bold text-[#d9ad75]" htmlFor="room-password">
            房间密码
          </label>
          <input
            id="room-password"
            type="password"
            value={password}
            onChange={event => setPassword(event.target.value)}
            className="w-full rounded border border-[#6f5942] bg-black/55 p-3 text-base text-white placeholder:text-gray-400 focus:border-[#d9ad75] focus:outline-none"
            placeholder="4–32 个字符"
            autoComplete="current-password"
            minLength={4}
            maxLength={32}
            required
          />
        </div>

        <button
          type="submit"
          className="mt-1 rounded bg-[#9a5f27] py-3 font-bold text-white transition-colors hover:bg-[#b97836] focus:outline-none focus:ring-2 focus:ring-[#d9ad75]"
        >
          创建或加入私人房
        </button>

        <p className="text-center text-xs leading-5 text-gray-500">
          请只把网址、房间号和密码分享给认识的朋友。
        </p>
      </form>
    </main>
  );
};
