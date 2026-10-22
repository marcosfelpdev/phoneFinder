import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { ClientToServerEvents, ServerToClientEvents, SOCKET_EVENTS } from 'shared';
import { systemRouter } from './routes/system.routes';
import { cardsRouter } from './routes/cards.routes';
import { presenceService } from './services/presence.service';
import { pairingService } from './services/pairing.service';
import { commandService } from './services/command.service';
import { getLanInterfaces } from './utils/lan-ip';
import { logger } from './utils/logger';

dotenv.config();

const PORT = parseInt(process.env.PORT || '3001', 10);
const HOST = process.env.HOST || '0.0.0.0';
const WEB_PORT = parseInt(process.env.VITE_PORT || '3000', 10);

const app = express();
const server = http.createServer(app);

// Configuração de CORS para a LAN local
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

app.use(express.json());

// Rotas da API REST
app.use('/api', systemRouter);
app.use('/api/cards', cardsRouter);

// Configuração do Socket.IO com tipagens do pacote shared
export const io = new Server<ClientToServerEvents, ServerToClientEvents>(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  pingTimeout: 10000,
  pingInterval: 5000,
});

// Injetar io no serviço de presença para broadcasts
presenceService.setIO(io);

io.on('connection', (socket) => {
  logger.info('Socket', `Cliente conectado: ${socket.id} (IP: ${socket.handshake.address})`);

  // 1. Geração de código de pareamento pelo Dashboard via Socket
  socket.on(SOCKET_EVENTS.PAIRING_GENERATE, async (payload) => {
    try {
      if (!payload?.cardId) return;
      const codeData = await pairingService.generateCode(payload.cardId);
      socket.emit(SOCKET_EVENTS.PAIRING_GENERATED, codeData);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao gerar código';
      logger.error('Socket', `Falha em pairing:generate: ${msg}`);
    }
  });

  // 2. Envio do código de pareamento pelo celular receptor
  socket.on(SOCKET_EVENTS.PAIRING_SUBMIT, async (payload) => {
    try {
      const result = await pairingService.validateAndPair(payload.code, socket.id);
      socket.emit(SOCKET_EVENTS.PAIRING_RESULT, result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao validar pareamento';
      socket.emit(SOCKET_EVENTS.PAIRING_RESULT, { success: false, error: msg });
    }
  });

  // 3. Identificação do dispositivo móvel na reconexão (via deviceId persistente)
  socket.on(SOCKET_EVENTS.DEVICE_IDENTIFY, async (payload) => {
    if (payload?.deviceId) {
      await presenceService.registerDeviceSocket(payload.deviceId, socket.id);
    }
  });

  // 4. Solicitação de desvinculação pelo dashboard
  socket.on(SOCKET_EVENTS.DEVICE_UNPAIR, async (payload) => {
    if (payload?.cardId) {
      await pairingService.unpairCard(payload.cardId);
    }
  });

  // 5. Comando "Localizar celular" disparado pelo Dashboard via Socket
  socket.on(SOCKET_EVENTS.LOCATE_TRIGGER, async (payload) => {
    try {
      if (!payload?.cardId) return;
      await commandService.triggerLocate(payload.cardId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao localizar celular';
      socket.emit(SOCKET_EVENTS.LOCATE_FEEDBACK, {
        cardId: payload.cardId,
        commandId: 'error',
        status: 'error',
        message: msg,
      });
    }
  });

  // 6. Confirmação (ACK) enviada pelo celular após receber o comando de tela vermelha
  socket.on(SOCKET_EVENTS.ALERT_ACK, (payload) => {
    if (payload?.commandId) {
      commandService.handleAck(payload);
    }
  });

  // 7. Desconexão
  socket.on('disconnect', async (reason) => {
    logger.info('Socket', `Cliente desconectado: ${socket.id} (Motivo: ${reason})`);
    await presenceService.handleSocketDisconnect(socket.id);
  });
});

// Inicialização do servidor em 0.0.0.0
server.listen(PORT, HOST, () => {
  const interfaces = getLanInterfaces(WEB_PORT);

  logger.info('Server', `Servidor iniciado com sucesso em http://${HOST}:${PORT}`);
  logger.info('Server', `Endereços detectados para acesso via celulares na mesma rede Wi-Fi:`);
  interfaces.forEach((iface) => {
    logger.info('LAN', `-> [${iface.name}] Celular: ${iface.receiverUrl}`);
    logger.info('LAN', `-> [${iface.name}] Dashboard: ${iface.dashboardUrl}`);
  });
});

export { app, server };
