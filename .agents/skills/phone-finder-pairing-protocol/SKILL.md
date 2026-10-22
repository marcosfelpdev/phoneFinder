---
name: phone-finder-pairing-protocol
description: >-
  Standardizes the Phone Finder real-time communication protocol, Socket.IO event contracts,
  pairing lifecycle, presence detection, and command dispatching.
  Use when implementing or debugging WebSocket events, device pairing, or locate commands.
---

# Phone Finder Pairing & Real-Time Protocol Standard

Esta skill padroniza o fluxo de eventos Socket.IO para pareamento seguro, detecção de presença e envio de comandos de localização visual.

## 1. Regras do Fluxo de Pareamento

1. **Geração do Código**:
   - O dashboard envia `pairing:generate` com `cardId`.
   - O servidor gera uma string numérica de 6 dígitos (de `100000` a `999999`) usando `crypto.randomInt`.
   - O servidor armazena o código na memória com `expiresAt = Date.now() + 5 * 60 * 1000`.
   - O servidor retorna `pairing:generated` ao dashboard.

2. **Validação e Associação**:
   - O celular receptor envia `pairing:submit` com `{ code }`.
   - O servidor valida:
     - O código existe na memória?
     - `Date.now() <= expiresAt`?
     - Se inválido ou expirado, emite `pairing:result` com `{ success: false, error: 'Código inválido ou expirado' }`.
   - Se válido:
     - Gera um `deviceId` único persistente (UUID v4).
     - Atualiza o card no repositório persistente vinculando `pairedDeviceId = deviceId`.
     - Remove o código da tabela de códigos ativos imediatamente (uso único).
     - Associa o `socket.id` atual ao `deviceId`.
     - Emite `pairing:result` com `{ success: true, deviceId, cardName }` para o celular.
     - Emite `device:status` com `{ cardId, isConnected: true }` para o dashboard.

3. **Reconexão Transparente**:
   - Celulares já pareados mantêm o `deviceId` em armazenamento persistente do cliente.
   - Ao reconectar, emitem `device:identify` com `{ deviceId }`.
   - O servidor localiza o card associado no repositório.
   - Se o card existir, vincula o novo `socket.id` ao `deviceId` e emite `device:status` online para o dashboard.
   - Se o card não existir mais (foi excluído), responde com erro forçando o reset do receptor.

## 2. Fluxo do Comando "Localizar Celular"

1. **Validação no Servidor**:
   - Dashboard emite `locate:trigger` com `{ cardId }`.
   - Servidor busca o card. Se `pairedDeviceId` for nulo ou se o `deviceId` não possuir socket ativo na tabela `activeSockets`, rejeita imediatamente com mensagem "Dispositivo desconectado".
2. **Despacho Isolado**:
   - Servidor obtém o `socketId` do dispositivo alvo.
   - Servidor gera `commandId = crypto.randomUUID()`.
   - Servidor envia `alert:locate` **estritamente para `io.to(targetSocketId)`**. Proibido usar broadcast.
   - Servidor inicia timer de timeout de 7 segundos aguardando `alert:ack`.
3. **Execução no Receptor**:
   - Celular recebe `alert:locate`.
   - Verifica se o `commandId` já foi processado recentemente (deduplicação).
   - Aciona a tela 100% vermelha por 5000ms.
   - Envia `alert:ack` de volta ao servidor.
4. **Finalização**:
   - Servidor recebe o `alert:ack` e cancela o timer de timeout.
   - Servidor emite `locate:feedback` com `{ status: 'success' }` para o dashboard.
   - Após 5000ms, o receptor desliga a tela vermelha automaticamente e retorna à tela de monitoramento.

Consulte a especificação de eventos em [references/socket-events-spec.md](./references/socket-events-spec.md).
