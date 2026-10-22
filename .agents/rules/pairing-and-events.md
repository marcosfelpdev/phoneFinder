# Regras de Pareamento e Ciclo de Eventos Socket.IO — Phone Finder

## 1. Ciclo de Vida do Pareamento

```
[Dashboard]              [Servidor]                [Celular / Receptor]
     |                       |                              |
     |-- 1. Gerar Código --->|                              |
     |   (cardId)            | Gera código (6 dígitos)      |
     |                       | Validade: 5 min              |
     |<-- Retorna código ----|                              |
     |   (ex: 749201)        |                              |
     |                       |                              |
     |                       |<-- 2. Informa Código --------|
     |                       |    (code: "749201")          |
     |                       | Valida código e expiração    |
     |                       | Associa deviceId <-> cardId  |
     |                       | Invalida código              |
     |                       |-- 3. Pareamento OK --------->|
     |                       |    (deviceId gerado/salvo)   |
     |<-- 4. Card Atualizado-|                              |
     |    (status: conectado)|                              |
```

### 1.1 Regras Rígidas de Pareamento
1. **Geração**: O código é estritamente de 6 dígitos numéricos, gerado com gerador pseudo-aleatório seguro no servidor.
2. **Tempo de Expiração**: 300 segundos (5 minutos). Após esse tempo, o código é descartado pela rotina de limpeza do servidor.
3. **Consumo Único**: No momento em que um celular envia o código e a validação tem sucesso, o código é destruído.
4. **Isolamento de Dispositivo**:
   - Um celular não pode sobrescrever a vinculação de outro celular silenciosamente.
   - Caso um card já possua um dispositivo pareado, uma nova tentativa de pareamento só é permitida se o usuário solicitar explicitamente "Desvincular Dispositivo" no dashboard ou "Gerar novo código".
   - A desvinculação emite um evento `device:unpaired` para o celular desconectar de volta para a tela inicial de pareamento.
5. **Identidade Persistente (`deviceId`)**:
   - O `deviceId` (UUID v4) é a credencial persistente do aparelho.
   - O receptor web armazena em `localStorage.getItem('phone_finder_device_id')`.
   - O aplicativo Android armazena em `SharedPreferences`.

---

## 2. Reconexão e Presença

1. **Reconexão Automática**:
   - Ao recarregar a página `/receiver` ou reabrir o app Android, se houver um `deviceId` salvo, o cliente emite `device:identify` contendo `{ deviceId }`.
   - O servidor verifica se o `deviceId` pertence a algum card registrado.
   - Se pertencer, o socket atual é vinculado ao card e o status é emitido para o Dashboard como `status: 'connected'`.
   - Se o card foi excluído ou desvinculado, o servidor responde com erro e o celular limpa seu armazenamento local voltando ao estado de não-pareado.
2. **Desconexão**:
   - Quando o socket desconecta (`disconnect`), o servidor verifica se o `deviceId` ainda tem outras conexões ativas. Se não houver, marca o card como `status: 'disconnected'` e emite atualização para o dashboard.

---

## 3. Protocolo do Comando "Localizar Celular"

```
[Dashboard]              [Servidor]                [Celular / Receptor]
     |                       |                              |
     |-- 1. locate(cardId) ->|                              |
     |                       | Valida se card está online   |
     |                       | Cria commandId (UUID)        |
     |                       |-- 2. alert:locate ---------->|
     |                       |    (commandId, duration: 5s) |
     |                       |                              | Liga tela vermelha (5s)
     |                       |<-- 3. alert:ack -------------|
     |                       |    (commandId, status: 'ok') |
     |<-- 4. locate:success -|                              |
     |    (cardId, feedback) |                              |
     |                       |                              | Apaga tela vermelha
```

### 3.1 Tratamento de Falha e Timeout
- Se o celular não enviar o `alert:ack` em até 7 segundos após o despacho, o servidor responde ao dashboard com `locate:error` informando timeout do dispositivo.
- O botão "Localizar celular" deve ser desabilitado durante a execução do comando e reabilitado após o ack ou timeout.
