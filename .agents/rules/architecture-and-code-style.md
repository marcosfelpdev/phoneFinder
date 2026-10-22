# Regras de Arquitetura e Estilo de Código — Phone Finder

## 1. Princípios de Arquitetura

### 1.1 Separação Rígida de Camadas
- **Camada de Apresentação (React)**:
  - Componentes devem ser puramente funcionais e focados em renderização e acessibilidade.
  - Toda a lógica de comunicação Socket.IO, polling ou fetch REST deve ser encapsulada em hooks customizados (ex.: `useSocket`, `useCards`, `usePairing`, `useWakeLock`).
  - Proibido misturar chamadas diretas de `socket.emit` ou `fetch` espalhadas no meio de componentes JSX.
- **Camada de Transporte do Servidor (Express / Socket.IO)**:
  - Rotas HTTP (`/api/*`) apenas validam requisições e delegam para a camada de serviços (`services/`).
  - Socket handlers (`sockets/*.ts`) apenas tratam deserialização de mensagens, validação de payload e acionam os serviços correspondentes.
- **Camada de Domínio / Regras de Negócio (`server/src/services`)**:
  - Toda a lógica de expiração de código, associação de dispositivo a card, e orquestração de despacho de comando reside nos serviços.
  - Nenhum serviço deve acessar diretamente o disco ou banco; deve sempre invocar a camada de repositório.
- **Camada de Acesso a Dados (`server/src/repositories`)**:
  - Implementar o **Repository Pattern** (`ICardRepository`).
  - A implementação inicial deve ser baseada em arquivo local (ex.: `JsonCardRepository`) com operações atômicas de escrita para evitar corrupção em crashes.
  - Preparado para substituição transparente por SQLite se necessário.
- **Contratos Compartilhados (`shared/`)**:
  - Todos os DTOs, payloads de eventos Socket.IO, interfaces de `Card`, `Device` e enums de status devem ser definidos no pacote `shared` e consumidos por `apps/web` e `server`.

### 1.2 Tipagem TypeScript Rigorosa
- O compilador TypeScript deve rodar com `"strict": true` em todos os pacotes.
- **Proibido o uso de `any`**. Caso um tipo seja temporariamente desconhecido, utilize `unknown` com type guards explícitos.
- Utilizar discriminators/unions para eventos e respostas de socket (ex.: `{ success: true, data: T } | { success: false, error: string }`).

### 1.3 Estilização e Design System
- Utilizar Vanilla CSS responsivo com CSS custom properties (variáveis CSS) para temas e espaçamentos consistentes.
- O layout do dashboard deve ser limpo, profissional e de alta legibilidade, otimizado para monitores de computadores de bancada e laptops.
- A tela do receptor (`/receiver`) deve ser 100% responsiva (mobile-first), com meta viewport `viewport-fit=cover` e sem scrollbars indesejadas.
- Durante o comando "Localizar celular", a tela receptora deve preencher 100% da viewport (incluindo safe areas) na cor vermelha pura (#FF0000) sem elementos sobrepostos.

### 1.4 Tratamento de Erros e Logs
- O backend deve possuir logging contextual padronizado com prefixos (ex.: `[Socket]`, `[Pairing]`, `[Command]`).
- Todos os endpoints e handlers de socket devem retornar erros legíveis e descritivos para a interface do usuário.
