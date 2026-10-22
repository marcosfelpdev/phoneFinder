/**
 * Modelo de Card persistido no banco de dados local.
 */
export interface Card {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  pairedDeviceId?: string;
}

/**
 * Status de conectividade em tempo real.
 */
export type DeviceConnectionStatus = 'connected' | 'disconnected';

/**
 * Card enriquecido com o status em tempo real da conexão WebSocket.
 */
export interface CardWithStatus extends Card {
  status: DeviceConnectionStatus;
  isLocating?: boolean;
}

/**
 * DTO para cadastro de novo card.
 */
export interface CreateCardDTO {
  name: string;
  description?: string;
}

/**
 * DTO para atualização de card existente.
 */
export interface UpdateCardDTO {
  name?: string;
  description?: string;
}
