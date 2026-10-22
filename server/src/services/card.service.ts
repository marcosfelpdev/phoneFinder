import { CardWithStatus, CreateCardDTO, UpdateCardDTO } from 'shared';
import { cardRepository } from '../repositories/json-card.repository';
import { presenceService } from './presence.service';
import { logger } from '../utils/logger';

export class CardService {
  async getAllCardsWithStatus(): Promise<CardWithStatus[]> {
    const cards = await cardRepository.findAll();
    return cards.map((card) => {
      const isConnected = presenceService.isDeviceConnected(card.pairedDeviceId);
      return {
        ...card,
        status: isConnected ? 'connected' : 'disconnected',
      };
    });
  }

  async getCardByIdWithStatus(id: string): Promise<CardWithStatus | null> {
    const card = await cardRepository.findById(id);
    if (!card) return null;

    const isConnected = presenceService.isDeviceConnected(card.pairedDeviceId);
    return {
      ...card,
      status: isConnected ? 'connected' : 'disconnected',
    };
  }

  async createCard(dto: CreateCardDTO): Promise<CardWithStatus> {
    const trimmedName = dto.name?.trim();
    if (!trimmedName || trimmedName.length < 2) {
      throw new Error('O nome do celular deve conter pelo menos 2 caracteres.');
    }
    if (trimmedName.length > 50) {
      throw new Error('O nome do celular deve conter no máximo 50 caracteres.');
    }

    const trimmedDescription = dto.description?.trim();
    if (trimmedDescription && trimmedDescription.length > 150) {
      throw new Error('A descrição deve conter no máximo 150 caracteres.');
    }

    const created = await cardRepository.create({
      name: trimmedName,
      description: trimmedDescription || undefined,
    });

    return {
      ...created,
      status: 'disconnected',
    };
  }

  async updateCard(id: string, dto: UpdateCardDTO): Promise<CardWithStatus | null> {
    const existing = await cardRepository.findById(id);
    if (!existing) return null;

    if (dto.name !== undefined) {
      const trimmedName = dto.name.trim();
      if (!trimmedName || trimmedName.length < 2) {
        throw new Error('O nome do celular deve conter pelo menos 2 caracteres.');
      }
      if (trimmedName.length > 50) {
        throw new Error('O nome do celular deve conter no máximo 50 caracteres.');
      }
    }

    if (dto.description !== undefined) {
      const trimmedDescription = dto.description.trim();
      if (trimmedDescription && trimmedDescription.length > 150) {
        throw new Error('A descrição deve conter no máximo 150 caracteres.');
      }
    }

    const updated = await cardRepository.update(id, {
      ...(dto.name !== undefined && { name: dto.name.trim() }),
      ...(dto.description !== undefined && { description: dto.description.trim() || undefined }),
    });

    if (!updated) return null;

    const isConnected = presenceService.isDeviceConnected(updated.pairedDeviceId);
    return {
      ...updated,
      status: isConnected ? 'connected' : 'disconnected',
    };
  }

  async deleteCard(id: string): Promise<boolean> {
    const existing = await cardRepository.findById(id);
    if (!existing) return false;

    if (existing.pairedDeviceId) {
      await presenceService.unpairDevice(existing.pairedDeviceId);
    }

    const deleted = await cardRepository.delete(id);
    if (deleted) {
      logger.info('CardService', `Card ${id} deletado com sucesso`);
    }
    return deleted;
  }
}

export const cardService = new CardService();
