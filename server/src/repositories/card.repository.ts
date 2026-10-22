import { Card } from 'shared';

/**
 * Interface do repositório de persistência de cards (Repository Pattern).
 */
export interface ICardRepository {
  findAll(): Promise<Card[]>;
  findById(id: string): Promise<Card | null>;
  findByDeviceId(deviceId: string): Promise<Card | null>;
  create(data: Omit<Card, 'id' | 'createdAt'>): Promise<Card>;
  update(id: string, updates: Partial<Omit<Card, 'id' | 'createdAt'>>): Promise<Card | null>;
  delete(id: string): Promise<boolean>;
}
