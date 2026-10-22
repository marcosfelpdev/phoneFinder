import { io, Socket } from 'socket.io-client';
import { ClientToServerEvents, ServerToClientEvents } from 'shared';

// No ambiente de navegador, se estiver acessando via IP da LAN (ex: 192.168.1.4:3000),
// o socket se conecta à porta 3001 do mesmo hostname
const socketServerUrl =
  import.meta.env.VITE_SERVER_URL ||
  `${window.location.protocol}//${window.location.hostname}:3001`;

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(socketServerUrl, {
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 10000,
  transports: ['websocket', 'polling'],
});
