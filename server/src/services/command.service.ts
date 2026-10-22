import crypto from 'crypto';
import { LocateAlertPayload, LocateAckPayload, LocateFeedbackPayload, SOCKET_EVENTS } from 'shared';
import { cardRepository } from '../repositories/json-card.repository';
import { presenceService } from './presence.service';
import { io } from '../index';
import { logger } from '../utils/logger';

const COMMAND_TIMEOUT_MS = 7000; // 7 segundos para timeout de resposta
const DEFAULT_ALERT_DURATION_MS = 5000; // 5 segundos de tela vermelha

interface PendingCommand {
  commandId: string;
  cardId: string;
  timeoutTimer: NodeJS.Timeout;
  resolve: (feedback: LocateFeedbackPayload) => void;
}

export class CommandService {
  private pendingCommands: Map<string, PendingCommand> = new Map();

  /**
   * Dispara o comando de localização para o celular físico associado ao card.
   */
  async triggerLocate(cardId: string): Promise<LocateFeedbackPayload> {
    const card = await cardRepository.findById(cardId);
    if (!card) {
      throw new Error('Card não encontrado.');
    }

    if (!card.pairedDeviceId) {
      throw new Error('Este card não possui nenhum celular pareado.');
    }

    const deviceId = card.pairedDeviceId;
    const isOnline = presenceService.isDeviceConnected(deviceId);
    if (!isOnline) {
      throw new Error('O celular precisa estar conectado na rede Wi-Fi para ser localizado.');
    }

    const targetSocketIds = presenceService.getSocketIdsForDevice(deviceId);
    if (targetSocketIds.length === 0) {
      throw new Error('Nenhum socket ativo encontrado para o celular.');
    }

    const commandId = crypto.randomUUID();
    const alertPayload: LocateAlertPayload = {
      commandId,
      durationMs: DEFAULT_ALERT_DURATION_MS,
    };

    logger.info('CommandService', `Despachando comando de localização ${commandId} para o celular "${card.name}" (${targetSocketIds.length} socket(s))`);

    return new Promise<LocateFeedbackPayload>((resolve) => {
      // Configurar timer de timeout de 7 segundos
      const timeoutTimer = setTimeout(() => {
        this.pendingCommands.delete(commandId);
        logger.warn('CommandService', `Timeout ao aguardar confirmação do celular no comando ${commandId}`);

        const timeoutFeedback: LocateFeedbackPayload = {
          cardId,
          commandId,
          status: 'timeout',
          message: 'O celular não respondeu ao comando de localização dentro do prazo de 7 segundos.',
        };

        if (io) {
          io.emit(SOCKET_EVENTS.LOCATE_FEEDBACK, timeoutFeedback);
        }

        resolve(timeoutFeedback);
      }, COMMAND_TIMEOUT_MS);

      this.pendingCommands.set(commandId, {
        commandId,
        cardId,
        timeoutTimer,
        resolve,
      });

      // Despacho estritamente direcionado aos sockets do dispositivo alvo
      if (io) {
        for (const socketId of targetSocketIds) {
          io.to(socketId).emit(SOCKET_EVENTS.ALERT_LOCATE, alertPayload);
        }
      }
    });
  }

  /**
   * Trata o acknowledgment (confirmação) retornado pelo celular.
   */
  handleAck(ack: LocateAckPayload): void {
    const pending = this.pendingCommands.get(ack.commandId);
    if (!pending) {
      logger.warn('CommandService', `ACK recebido para comando não pendente ou expirado: ${ack.commandId}`);
      return;
    }

    clearTimeout(pending.timeoutTimer);
    this.pendingCommands.delete(ack.commandId);

    const isSuccess = ack.status === 'ok';
    const feedback: LocateFeedbackPayload = {
      cardId: pending.cardId,
      commandId: ack.commandId,
      status: isSuccess ? 'success' : 'error',
      message: isSuccess
        ? 'Celular localizado com sucesso! Tela vermelha acionada por 5 segundos.'
        : 'O celular reportou um erro ao acionar a tela de localização.',
    };

    logger.info('CommandService', `ACK processado com sucesso para comando ${ack.commandId} (Status: ${ack.status})`);

    // Notificar Dashboard via Socket.IO
    if (io) {
      io.emit(SOCKET_EVENTS.LOCATE_FEEDBACK, feedback);
    }

    pending.resolve(feedback);
  }
}

export const commandService = new CommandService();
