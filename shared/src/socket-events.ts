import { PairingGeneratedPayload, PairingResultPayload } from './types/pairing.types';
import { LocateAlertPayload, LocateAckPayload, LocateFeedbackPayload } from './types/command.types';
import { DeviceConnectionStatus } from './types/card.types';

/**
 * Constantes de nomes de eventos Socket.IO padronizados.
 */
export const SOCKET_EVENTS = {
  // Pareamento
  PAIRING_GENERATE: 'pairing:generate',
  PAIRING_GENERATED: 'pairing:generated',
  PAIRING_SUBMIT: 'pairing:submit',
  PAIRING_RESULT: 'pairing:result',

  // Identificação e Presença de Dispositivo
  DEVICE_IDENTIFY: 'device:identify',
  DEVICE_STATUS: 'device:status',
  DEVICE_UNPAIR: 'device:unpair',
  DEVICE_UNPAIRED: 'device:unpaired',

  // Comando de Localização Visual
  LOCATE_TRIGGER: 'locate:trigger',
  ALERT_LOCATE: 'alert:locate',
  ALERT_ACK: 'alert:ack',
  LOCATE_FEEDBACK: 'locate:feedback',
} as const;

/**
 * Eventos emitidos pelo cliente (Dashboard e Receptor) para o Servidor.
 */
export interface ClientToServerEvents {
  [SOCKET_EVENTS.PAIRING_GENERATE]: (payload: { cardId: string }) => void;
  [SOCKET_EVENTS.PAIRING_SUBMIT]: (payload: { code: string }) => void;
  [SOCKET_EVENTS.DEVICE_IDENTIFY]: (payload: { deviceId: string }) => void;
  [SOCKET_EVENTS.LOCATE_TRIGGER]: (payload: { cardId: string }) => void;
  [SOCKET_EVENTS.ALERT_ACK]: (payload: LocateAckPayload) => void;
  [SOCKET_EVENTS.DEVICE_UNPAIR]: (payload: { cardId: string }) => void;
}

/**
 * Eventos emitidos pelo Servidor para os clientes (Dashboard e Receptor).
 */
export interface ServerToClientEvents {
  [SOCKET_EVENTS.PAIRING_GENERATED]: (payload: PairingGeneratedPayload) => void;
  [SOCKET_EVENTS.PAIRING_RESULT]: (payload: PairingResultPayload) => void;
  [SOCKET_EVENTS.DEVICE_STATUS]: (payload: { cardId: string; status: DeviceConnectionStatus; deviceId?: string }) => void;
  [SOCKET_EVENTS.ALERT_LOCATE]: (payload: LocateAlertPayload) => void;
  [SOCKET_EVENTS.LOCATE_FEEDBACK]: (payload: LocateFeedbackPayload) => void;
  [SOCKET_EVENTS.DEVICE_UNPAIRED]: (payload: { message: string }) => void;
}
