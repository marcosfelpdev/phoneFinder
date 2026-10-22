import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { ClientToServerEvents, ServerToClientEvents } from 'shared';
import { systemRouter } from './routes/system.routes';
import { cardsRouter } from './routes/cards.routes';
import { presenceService } from './services/presence.service';
import { getLanInterfaces } from './utils/lan-ip';
import { logger } from './utils/logger';

dotenv.config();

const PORT = parseInt(process.env.PORT || '3001', 10);
const HOST = process.env.HOST || '0.0.0.0';
const WEB_PORT = parseInt(process.env.VITE_PORT || '3000', 10);

const app = express();
const server = http.createServer(app);

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

app.use('/api', systemRouter);
app.use('/api/cards', cardsRouter);

export const io = new Server<ClientToServerEvents, ServerToClientEvents>(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 10000,
  pingInterval: 5000,
});

presenceService.setIO(io);

io.on('connection', (socket) => {
  logger.info('Socket', `Cliente conectado: ${socket.id} (IP: ${socket.handshake.address})`);
  socket.on('disconnect', async (reason) => {
    logger.info('Socket', `Cliente desconectado: ${socket.id} (Motivo: ${reason})`);
    await presenceService.handleSocketDisconnect(socket.id);
  });
});

server.listen(PORT, HOST, () => {
  const interfaces = getLanInterfaces(WEB_PORT);
  logger.info('Server', `Servidor iniciado com sucesso em http://${HOST}:${PORT}`);
  interfaces.forEach((iface) => {
    logger.info('LAN', `-> [${iface.name}] Celular: ${iface.receiverUrl}`);
    logger.info('LAN', `-> [${iface.name}] Dashboard: ${iface.dashboardUrl}`);
  });
});

export { app, server };
