# Especificação Detalhada do Protocolo de Eventos Socket.IO

## 1. Mapeamento de Eventos

| Evento | Origem | Destino | Payload | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `pairing:generate` | Dashboard | Servidor | `{ cardId: string }` | Solicita novo código de 6 dígitos para o card. |
| `pairing:generated` | Servidor | Dashboard | `{ cardId: string, code: string, expiresAt: number }` | Retorna o código com timestamp de expiração (5 min). |
| `pairing:submit` | Receptor | Servidor | `{ code: string }` | Celular envia o código de pareamento digitado. |
| `pairing:result` | Servidor | Receptor | `{ success: boolean, deviceId?: string, cardName?: string, error?: string }` | Resultado da tentativa de pareamento. |
| `device:identify` | Receptor | Servidor | `{ deviceId: string }` | Celular já pareado se identifica ao conectar/reconectar. |
| `device:status` | Servidor | Dashboard | `{ cardId: string, isConnected: boolean, deviceId?: string }` | Atualiza status online/offline em tempo real no dashboard. |
| `locate:trigger` | Dashboard | Servidor | `{ cardId: string }` | Dashboard solicita localização de um celular. |
| `alert:locate` | Servidor | Receptor | `{ commandId: string, durationMs: number }` | Servidor envia comando para o celular alvo ligar a tela vermelha. |
| `alert:ack` | Receptor | Servidor | `{ commandId: string, status: 'ok' \| 'error' }` | Celular confirma recebimento e início da tela vermelha. |
| `locate:feedback` | Servidor | Dashboard | `{ cardId: string, commandId: string, status: 'success' \| 'timeout' \| 'error', message: string }` | Feedback de execução para o dashboard. |
| `device:unpair` | Dashboard | Servidor | `{ cardId: string }` | Desvincula o dispositivo associado ao card. |
| `device:unpaired` | Servidor | Receptor | `{ message: string }` | Notifica o receptor que ele foi desvinculado, resetando-o. |

## 2. Tipos de Dados Compartilhados (shared)

```typescript
export interface PairingCodeEntry {
  code: string;           // 6 dígitos
  cardId: string;
  expiresAt: number;      // Epoch ms
}

export interface LocateAlertPayload {
  commandId: string;      // UUID v4
  durationMs: number;     // Padrão: 5000ms
}

export interface LocateAckPayload {
  commandId: string;
  status: 'ok' | 'error';
  timestamp: number;
}
```

## 3. Gestão de Estado em Memória no Servidor

O servidor deve manter duas tabelas hash em memória:
1. `activeSockets: Map<string, string>` (Mapeia `deviceId -> socketId`).
2. `socketToDevice: Map<string, string>` (Mapeia `socketId -> deviceId`).
3. `activePairingCodes: Map<string, PairingCodeEntry>` (Mapeia `code -> PairingCodeEntry`).

Ao receber `disconnect`, limpa os mapeamentos do socket e notifica o card correspondente com `isConnected: false`.
