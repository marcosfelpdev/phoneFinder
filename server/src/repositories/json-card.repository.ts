import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Card } from 'shared';
import { ICardRepository } from './card.repository';
import { logger } from '../utils/logger';

export class JsonCardRepository implements ICardRepository {
  private filePath: string;
  private isLoaded: boolean = false;
  private cache: Map<string, Card> = new Map();

  constructor(filePath?: string) {
    this.filePath = filePath || path.join(__dirname, '../../data/cards.json');
    this.ensureDirectoryExists();
  }

  private ensureDirectoryExists(): void {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private async loadFromFile(): Promise<void> {
    if (this.isLoaded) return;

    try {
      if (fs.existsSync(this.filePath)) {
        const raw = await fs.promises.readFile(this.filePath, 'utf-8');
        const cards: Card[] = JSON.parse(raw);
        this.cache.clear();
        for (const card of cards) {
          this.cache.set(card.id, card);
        }
      } else {
        this.cache.clear();
        await this.persist();
      }
      this.isLoaded = true;
    } catch (err) {
      logger.error('Repository', 'Erro ao ler arquivo de persistência de cards:', err);
      this.cache.clear();
      this.isLoaded = true;
    }
  }

  private async persist(): Promise<void> {
    const tmpPath = `${this.filePath}.tmp`;
    const cardsArray = Array.from(this.cache.values());
    const data = JSON.stringify(cardsArray, null, 2);

    // Escrita atômica: salva no temporário e renomeia
    await fs.promises.writeFile(tmpPath, data, 'utf-8');
    await fs.promises.rename(tmpPath, this.filePath);
  }

  async findAll(): Promise<Card[]> {
    await this.loadFromFile();
    return Array.from(this.cache.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async findById(id: string): Promise<Card | null> {
    await this.loadFromFile();
    return this.cache.get(id) || null;
  }

  async findByDeviceId(deviceId: string): Promise<Card | null> {
    await this.loadFromFile();
    for (const card of this.cache.values()) {
      if (card.pairedDeviceId === deviceId) {
        return card;
      }
    }
    return null;
  }

  async create(data: Omit<Card, 'id' | 'createdAt'>): Promise<Card> {
    await this.loadFromFile();
    const newCard: Card = {
      id: crypto.randomUUID(),
      name: data.name.trim(),
      description: data.description ? data.description.trim() : undefined,
      createdAt: new Date().toISOString(),
      pairedDeviceId: data.pairedDeviceId,
    };

    this.cache.set(newCard.id, newCard);
    await this.persist();
    logger.info('Repository', `Card criado com sucesso: ${newCard.name} (${newCard.id})`);
    return newCard;
  }

  async update(id: string, updates: Partial<Omit<Card, 'id' | 'createdAt'>>): Promise<Card | null> {
    await this.loadFromFile();
    const existing = this.cache.get(id);
    if (!existing) return null;

    const updated: Card = {
      ...existing,
      ...(updates.name !== undefined && { name: updates.name.trim() }),
      ...(updates.description !== undefined && { description: updates.description.trim() }),
      pairedDeviceId: 'pairedDeviceId' in updates ? updates.pairedDeviceId : existing.pairedDeviceId,
    };

    this.cache.set(id, updated);
    await this.persist();
    logger.info('Repository', `Card atualizado: ${updated.name} (${updated.id})`);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    await this.loadFromFile();
    const exists = this.cache.has(id);
    if (!exists) return false;

    this.cache.delete(id);
    await this.persist();
    logger.info('Repository', `Card removido: ${id}`);
    return true;
  }
}

// Instância Singleton padrão do repositório
export const cardRepository: ICardRepository = new JsonCardRepository();
