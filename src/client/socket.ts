import { io, Socket } from 'socket.io-client';
declare const __GAME_SERVER__: string;
export const socket: Socket = io(__GAME_SERVER__ || undefined, { timeout: 20000 });
