/**
 * Payload despachado para o celular com o comando de tela vermelha.
 */
export interface LocateAlertPayload {
  commandId: string;    // UUID v4 para prevenção de execução duplicada
  durationMs: number;   // Duração da tela vermelha (padrão: 5000ms)
}

/**
 * Acknowledgment enviado pelo celular confirmando recebimento do comando.
 */
export interface LocateAckPayload {
  commandId: string;
  status: 'ok' | 'error';
  timestamp: number;
}

/**
 * Feedback da execução do comando encaminhado para o Dashboard.
 */
export interface LocateFeedbackPayload {
  cardId: string;
  commandId: string;
  status: 'success' | 'timeout' | 'error';
  message: string;
}
