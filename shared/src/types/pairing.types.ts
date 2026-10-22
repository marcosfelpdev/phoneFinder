/**
 * Registro de código de pareamento temporário em memória no servidor.
 */
export interface PairingCodeEntry {
  code: string;       // Código numérico de 6 dígitos
  cardId: string;     // ID do card correspondente
  expiresAt: number;  // Timestamp de expiração em milissegundos (5 min)
}

/**
 * Resposta de sucesso ou falha da validação de pareamento enviada ao receptor.
 */
export interface PairingResultPayload {
  success: boolean;
  deviceId?: string;
  cardId?: string;
  cardName?: string;
  error?: string;
}

/**
 * Resposta da geração de código enviada ao Dashboard.
 */
export interface PairingGeneratedPayload {
  cardId: string;
  code: string;
  expiresAt: number;
}
