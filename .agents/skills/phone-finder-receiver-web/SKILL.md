---
name: phone-finder-receiver-web
description: >-
  Guides the development, styling, and lifecycle management of the Phone Finder
  Web Receiver (/receiver) for mobile browser testing.
  Use when implementing or enhancing the mobile web receiver, Wake Lock API, or the full-screen visual alert.
---

# Phone Finder Web Receiver Standard

Esta skill padroniza a implementação da rota de teste móvel `/receiver`, focando em responsividade, usabilidade e renderização do alerta visual de tela vermelha.

## 1. Requisitos de Interface e Estilo

- **Viewport**: `<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />`.
- **Estados da Interface**:
  1. **Não Pareado**: Campo para digitar o código de 6 dígitos numéricos, botão "Conectar", indicador de status de conexão WebSocket com o servidor local.
  2. **Pareado e Monitorando**: Exibe o nome do card ao qual está vinculado (ex.: "Vinculado a: Celular Estoque 01"), status "Conectado e aguardando chamadas", botão discreto para "Desconectar/Desvincular", e aviso sobre manter a tela aberta.
  3. **Alerta Ativo (Localizando)**:
     - Overlay cobrindo 100% da tela: `position: fixed; inset: 0; background-color: #FF0000; z-index: 999999;`.
     - Nenhum texto, botão ou ícone visível na tela durante o disparo.
     - Duração exata: 5000 milissegundos.
     - Ao concluir os 5000ms, remove a classe do overlay e volta ao estado normal.

## 2. Implementação do WakeLock (Manter Tela Ligada)

Para evitar que a tela do celular apague por timeout do sistema operacional enquanto aguarda o comando na bancada:

```typescript
let wakeLock: WakeLockSentinel | null = null;

export async function requestScreenWakeLock() {
  if ('wakeLock' in navigator) {
    try {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => {
        wakeLock = null;
      });
    } catch (err) {
      console.warn('Wake Lock request failed:', err);
    }
  }
}
```

## 3. Persistência de Identidade no Cliente
- Chave no LocalStorage: `phone_finder_device_id`.
- Ao carregar a página:
  - Se existir `deviceId`, inicia o socket e emite `device:identify`.
  - Se não existir, exibe o formulário de pareamento.
- Ao clicar em "Desvincular": remove a chave do LocalStorage e reinicia o estado.

Consulte mais detalhes em [references/mobile-web-limitations.md](./references/mobile-web-limitations.md).
