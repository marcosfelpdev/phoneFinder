import { Server } from 'socket.io';
import { ClientToServerEvents, ServerToClientEvents, SOCKET_EVENTS } from 'shared';
import { cardRepository } from '../repositories/json-card.repository';
import { logger } from '../utils/logger';

export class PresenceService {
  private deviceSockets: Map<string, Set<string>> = new Map();
  private socketDeviceMap: Map<string, string> = new Map();
  private io: Server<ClientToServerEvents, ServerToClientEvents> | null = null;

  setIO(io: Server<ClientToServerEvents, ServerToClientEvents>) {
    this.io = io;
  }

  isDeviceConnected(deviceId?: string): boolean {
    if (!deviceId) return false;
    const sockets = this.deviceSockets.get(deviceId);
    return !!(sockets && sockets.size > 0);
  }

  getSocketIdsForDevice(deviceId: string): string[] {
    const sockets = this.deviceSockets.get(deviceId);
    return sockets ? Array.from(sockets) : [];
  }

  async registerDeviceSocket(deviceId: string, socketId: string): Promise<void> {
    if (!this.deviceSockets.has(deviceId)) {
      this.deviceSockets.set(deviceId, new Set());
    }
    this.deviceSockets.get(deviceId)!.add(socketId);
    this.socketDeviceMap.set(socketId, deviceId);

    logger.info('Presence', `Dispositivo conectado: ${deviceId} via socket ${socketId}`);

    // Buscar card associado para notificar o Dashboard
    const card = await cardRepository.findByDeviceId(deviceId);
    if (card && this.io) {
      this.io.emit(SOCKET_EVENTS.DEVICE_STATUS, {
        cardId: card.id,
        status: 'connected',
        deviceId,
      });
      logger.info('Presence', `Notificado Dashboard: Card "${card.name}" está ONLINE`);
    }
  }

  async handleSocketDisconnect(socketId: string): Promise<void> {
    const deviceId = this.socketDeviceMap.get(socketId);
    if (!deviceId) return;

    this.socketDeviceMap.delete(socketId);
    const sockets = this.deviceSockets.get(deviceId);
    if (sockets) {
      sockets.delete(socketId);
      if (sockets.size === 0) {
        this.deviceSockets.delete(deviceId);
        logger.info('Presence', `Dispositivo completamente desconectado: ${deviceId}`);

        // Notificar o Dashboard que o card está OFFLINE
        const card = await cardRepository.findByDeviceId(deviceId);
        if (card && this.io) {
          this.io.emit(SOCKET_EVENTS.DEVICE_STATUS, {
            cardId: card.id,
            status: 'disconnected',
            deviceId,
          });
          logger.info('Presence', `Notificado Dashboard: Card "${card.name}" está OFFLINE`);
        }
      }
    }
  }

  async unpairDevice(deviceId: string): Promise<void> {
    const sockets = this.getSocketIdsForDevice(deviceId);
    for (const socketId of sockets) {
      this.socketDeviceMap.delete(socketId);
    }
    this.deviceSockets.delete(deviceId);
  }
}

export const presenceService = new PresenceService();
