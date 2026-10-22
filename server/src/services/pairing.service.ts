import crypto from 'crypto';
import { PairingCodeEntry, PairingGeneratedPayload, PairingResultPayload, SOCKET_EVENTS } from 'shared';
import { cardRepository } from '../repositories/json-card.repository';
import { presenceService } from './presence.service';
import { io } from '../index';
import { logger } from '../utils/logger';

const PAIRING_EXPIRY_MS = 5 * 60 * 1000; // 5 minutos

export class PairingService {
  // Mapa de código (6 dígitos) -> PairingCodeEntry
  private codes: Map<string, PairingCodeEntry> = new Map();
  // Mapa de cardId -> código (para invalidar código anterior se um novo for solicitado)
  private cardToCode: Map<string, string> = new Map();

  constructor() {
    // Limpeza periódica de códigos expirados a cada 30 segundos
    setInterval(() => {
      this.cleanupExpiredCodes();
    }, 30000);
  }

  private cleanupExpiredCodes(): void {
    const now = Date.now();
    for (const [code, entry] of this.codes.entries()) {
      if (entry.expiresAt <= now) {
        this.codes.delete(code);
        this.cardToCode.delete(entry.cardId);
        logger.info('Pairing', `Código de pareamento expirado e removido: ${code} (Card: ${entry.cardId})`);
      }
    }
  }

  /**
   * Gera um código numérico de 6 dígitos para o card especificado.
   */
  async generateCode(cardId: string): Promise<PairingGeneratedPayload> {
    const card = await cardRepository.findById(cardId);
    if (!card) {
      throw new Error('Card não encontrado.');
    }

    // Invalida código anterior para o mesmo card, se houver
    const previousCode = this.cardToCode.get(cardId);
    if (previousCode) {
      this.codes.delete(previousCode);
      this.cardToCode.delete(cardId);
    }

    // Gera código seguro de 6 dígitos numéricos (100000 a 999999)
    const code = crypto.randomInt(100000, 1000000).toString();
    const expiresAt = Date.now() + PAIRING_EXPIRY_MS;

    const entry: PairingCodeEntry = {
      code,
      cardId,
      expiresAt,
    };

    this.codes.set(code, entry);
    this.cardToCode.set(cardId, code);

    logger.info('Pairing', `Novo código gerado para o card "${card.name}": [${code}], expira em 5 min`);

    return {
      cardId,
      code,
      expiresAt,
    };
  }

  /**
   * Valida o código enviado pelo celular e vincula o aparelho ao card correspondente.
   */
  async validateAndPair(code: string, socketId: string): Promise<PairingResultPayload> {
    const trimmedCode = code?.trim();
    if (!trimmedCode || !/^\d{6}$/.test(trimmedCode)) {
      return {
        success: false,
        error: 'O código de pareamento deve conter exatamente 6 dígitos numéricos.',
      };
    }

    const entry = this.codes.get(trimmedCode);
    if (!entry) {
      return {
        success: false,
        error: 'Código inválido ou inexistente.',
      };
    }

    if (Date.now() > entry.expiresAt) {
      this.codes.delete(trimmedCode);
      this.cardToCode.delete(entry.cardId);
      return {
        success: false,
        error: 'Este código de pareamento expirou. Gere um novo código no dashboard.',
      };
    }

    const card = await cardRepository.findById(entry.cardId);
    if (!card) {
      this.codes.delete(trimmedCode);
      this.cardToCode.delete(entry.cardId);
      return {
        success: false,
        error: 'O card correspondente a este código não existe mais.',
      };
    }

    // Código consumido com sucesso -> invalidação imediata (uso único)
    this.codes.delete(trimmedCode);
    this.cardToCode.delete(entry.cardId);

    // Gerar identidade persistente para o aparelho
    const deviceId = crypto.randomUUID();

    // Persistir o vínculo no card
    await cardRepository.update(card.id, {
      pairedDeviceId: deviceId,
    });

    // Registrar o socket ativo no serviço de presença
    await presenceService.registerDeviceSocket(deviceId, socketId);

    logger.info('Pairing', `Pareamento realizado com SUCESSO! Celular (${deviceId}) vinculado ao card "${card.name}" (${card.id})`);

    // Notificar o Dashboard que o card agora está conectado e vinculado
    if (io) {
      io.emit(SOCKET_EVENTS.DEVICE_STATUS, {
        cardId: card.id,
        status: 'connected',
        deviceId,
      });
    }

    return {
      success: true,
      deviceId,
      cardId: card.id,
      cardName: card.name,
    };
  }

  /**
   * Desvincula explicitamente um aparelho de seu card.
   */
  async unpairCard(cardId: string): Promise<boolean> {
    const card = await cardRepository.findById(cardId);
    if (!card || !card.pairedDeviceId) return false;

    const deviceId = card.pairedDeviceId;

    // Notificar os sockets do celular que ele foi desvinculado
    if (io) {
      const socketIds = presenceService.getSocketIdsForDevice(deviceId);
      for (const socketId of socketIds) {
        io.to(socketId).emit(SOCKET_EVENTS.DEVICE_UNPAIRED, {
          message: 'Este aparelho foi desvinculado pelo dashboard.',
        });
      }
    }

    // Limpar presença e desvincular no repositório persistente
    await presenceService.unpairDevice(deviceId);
    await cardRepository.update(cardId, { pairedDeviceId: undefined });

    // Notificar Dashboard
    if (io) {
      io.emit(SOCKET_EVENTS.DEVICE_STATUS, {
        cardId,
        status: 'disconnected',
      });
    }

    logger.info('Pairing', `Aparelho desvinculado do card "${card.name}" (${cardId})`);
    return true;
  }
}

export const pairingService = new PairingService();
