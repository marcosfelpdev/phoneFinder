---
name: phone-finder-architecture
description: >-
  Provides architectural guidelines, directory layout, shared types structure,
  and setup procedures for the Phone Finder monorepo (React, Express, Vite, Kotlin).
  Use when structuring, scaffolding, or maintaining the Phone Finder workspace.
---

# Phone Finder Architecture Standard

Esta skill orienta a organização arquitetural do repositório Phone Finder, a configuração do monorepo e a manutenção dos contratos entre camadas.

## 1. Estrutura de Diretórios e Responsabilidades

O projeto adota uma estrutura de monorepo utilizando workspaces do `npm`:

```text
phone-finder/
├── apps/
│   ├── web/                     # Frontend SPA (Dashboard + /receiver)
│   │   ├── package.json
│   │   ├── vite.config.ts
│   │   └── src/
│   │       ├── pages/           # Dashboard.tsx, Receiver.tsx
│   │       ├── components/      # CardList, DeviceCard, PairingModal, AddCardModal
│   │       ├── hooks/           # useCards, usePairing, useSocket, useWakeLock
│   │       └── services/        # socketService, apiService
│   └── android/                 # Aplicativo nativo Android
│       ├── build.gradle.kts
│       └── app/
├── server/                      # Backend Node.js
│   ├── package.json
│   └── src/
│       ├── index.ts             # Bootstrap HTTP + Socket.IO em 0.0.0.0
│       ├── routes/              # cards.routes.ts, system.routes.ts
│       ├── sockets/             # device.socket.ts, dashboard.socket.ts
│       ├── services/            # card.service.ts, pairing.service.ts, command.service.ts
│       ├── repositories/        # card.repository.ts, json-card.repository.ts
│       └── utils/               # lan-ip.ts, logger.ts
├── shared/                      # Contratos TypeScript compartilhados
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── types/               # card.types.ts, device.types.ts, command.types.ts
│       └── socket-events.ts     # Nomes de eventos e payloads Socket.IO
├── package.json                 # Raiz com workspaces: ["shared", "server", "apps/web"]
└── README.md
```

## 2. Configuração do Root `package.json`

O `package.json` da raiz deve gerenciar scripts unificados:
- `npm run dev`: Inicia concorrentemente o servidor backend e o Vite dev server.
- `npm run build`: Compila `shared`, `server` e `apps/web`.
- `npm run check:types`: Executa `tsc --noEmit` em todos os workspaces.

## 3. Isolamento da Camada de Persistência

1. Toda operação de leitura e gravação de cards deve passar pela interface:
   ```typescript
   export interface ICardRepository {
     findAll(): Promise<Card[]>;
     findById(id: string): Promise<Card | null>;
     findByDeviceId(deviceId: string): Promise<Card | null>;
     create(card: Omit<Card, 'id' | 'createdAt'>): Promise<Card>;
     update(id: string, updates: Partial<Omit<Card, 'id' | 'createdAt'>>): Promise<Card | null>;
     delete(id: string): Promise<boolean>;
   }
   ```
2. A implementação concreta deve salvar em `server/data/cards.json` com escrita atômica (gravação em arquivo temporário seguida de rename).

## 4. Passos para Validação da Arquitetura
1. Verificar se `shared` é compilado antes do `server` e do `apps/web`.
2. Garantir que nenhuma dependência externa do tipo CDN seja necessária em tempo de execução.
3. Certificar-se de que o backend inicializa o listener com `server.listen(port, '0.0.0.0')`.
