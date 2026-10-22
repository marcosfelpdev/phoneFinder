# Phone Finder — Contexto e Diretrizes do Projeto

## 1. Visão Geral
O **Phone Finder** é uma aplicação voltada para localização visual imediata de celulares físicos em ambientes de trabalho (como bancadas técnicas, depósitos, estoques ou escritórios de desenvolvimento e testes).
A operação é **100% em rede local Wi-Fi**, sem nenhuma dependência de infraestrutura na nuvem ou serviços externos.

O sistema opera através de:
1. **Dashboard Web (PC/Desktop)**: Permite cadastrar cards para representar aparelhos, gerar códigos de pareamento de 6 dígitos, monitorar o status online/offline em tempo real e disparar o comando "Localizar celular".
2. **Servidor Node.js + Express + Socket.IO**: Gerencia o ciclo de vida dos cartões, gera e valida códigos de pareamento com expiração de 5 minutos, mapeia conexões em tempo real por identificador persistente e despacha comandos com garantia de unicidade e target isolado.
3. **Receptor Web (`/receiver`)**: Interface leve e responsiva acessível pelo navegador do celular para testes imediatos sem instalação prévia.
4. **Cliente Android Nativo (Kotlin)**: Aplicativo nativo estruturado para controle direto da tela, maior confiabilidade de conexão e controle do ciclo de vida do dispositivo.

---

## 2. Tecnologias Obrigatórias e Arquitetura

### 2.1 Stack
- **Front-end**: React, TypeScript, Vite, CSS Vanilla moderno/responsivo, Socket.IO Client.
- **Back-end**: Node.js, TypeScript, Express, Socket.IO, persistência local em repositório desacoplado (JSON file com escrita segura ou SQLite).
- **Cliente Celular Web**: Rota dedicada `/receiver` no app Vite/React.
- **Cliente Celular Nativo**: Android app nativo em Kotlin com Socket.IO Java/Kotlin Client.
- **Monorepo**: Gerenciado via workspaces (`npm` workspaces).

### 2.2 Estrutura do Monorepo
```text
phone-finder/
├── .agents/
│   ├── AGENTS.md                  # Contexto e padrões gerais do projeto
│   ├── rules/                     # Regras de código, segurança e protocolo
│   └── skills/                    # Runbooks e procedimentos padronizados
├── apps/
│   ├── web/                       # Dashboard Web + Web Receiver (/receiver)
│   │   ├── index.html
│   │   ├── vite.config.ts
│   │   └── src/
│   │       ├── components/        # Cards, modais de pareamento, alertas
│   │       ├── pages/             # Dashboard (/), Receiver (/receiver)
│   │       ├── hooks/             # useSocket, useCards, usePairing
│   │       ├── services/          # API HTTP e instâncias de Socket
│   │       ├── types/             # Tipagens exclusivas de UI
│   │       └── styles/            # Design system, CSS variables, temas
│   └── android/                   # Aplicativo nativo Kotlin
│       ├── app/
│       │   ├── src/main/java/com/phonefinder/
│       │   └── src/main/res/
│       └── build.gradle.kts
├── server/
│   ├── src/
│   │   ├── routes/                # Endpoints REST (CRUD cards, status de rede)
│   │   ├── sockets/               # Handlers de eventos Socket.IO
│   │   ├── services/              # Regras de negócio (pairing, command dispatch)
│   │   ├── repositories/          # Persistência local (armazenamento de cards)
│   │   ├── types/                 # Tipos internos do servidor
│   │   ├── utils/                 # Helpers (lan IP helper, logger, crypto)
│   │   └── index.ts               # Inicialização HTTP + Socket.IO em 0.0.0.0
│   └── tsconfig.json
├── shared/
│   ├── src/
│   │   ├── types/                 # Modelos compartilhados (Card, Device, Command)
│   │   └── socket-events.ts       # Contratos e payloads de eventos Socket.IO
│   └── package.json
├── package.json                   # Raiz do workspace npm
├── .env.example
├── .gitignore
└── README.md
```

---

## 3. Regras de Negócio e Comportamento Crítico

### 3.1 Pareamento de Dispositivos
- Cada card cadastrado possui um identificador único imutável (`cardId`).
- O código de pareamento é **numérico de 6 dígitos** gerado aleatoriamente pelo servidor.
- **Tempo de Expiração**: 5 minutos exatos.
- **Uso Único**: O código é invalidado imediatamente após ser consumido com sucesso.
- O código nunca pode ser reutilizado ou compartilhado entre cards.
- Um celular já pareado não pode ser silenciosamente sobrescrito ou vinculado a outro card sem desvinculação explícita.
- O código de pareamento temporário **nunca** é salvo como credencial definitiva na base de dados persistente.
- Após o pareamento, o servidor gera/atribui um `deviceId` persistente que o celular armazena localmente (`localStorage` no receptor web, `SharedPreferences` no Android).

### 3.2 Comando "Localizar Celular"
- Disparado a partir do card no Dashboard, exclusivamente se o dispositivo estiver com status **conectado**.
- O servidor valida se o dispositivo está pareado e com socket ativo antes de despachar o comando.
- O comando possui um `commandId` único (UUID v4) para prevenção de execução duplicada.
- O comando é endereçado **estritamente ao socket do dispositivo alvo**. Dispositivos alheios nunca recebem o evento.
- **Ação no Celular**: Tela preenchida 100% de vermelho intenso (#FF0000) por exatamente **5 segundos**, sem textos ou botões que obstruam a identificação visual.
- Após 5 segundos, a tela retorna automaticamente ao estado anterior.
- O celular envia uma confirmação de execução (`command:ack`) de volta ao servidor, que repassa o feedback ao dashboard.
- Caso o aparelho não responda em até 7 segundos, o dashboard exibe notificação de falha/timeout.

### 3.3 Presença e Conectividade
- O status de conexão (online/offline) é puramente **em tempo real e em memória**; não deve ser considerado o valor salvo no banco de dados na inicialização do servidor.
- Ao reiniciar o servidor, todos os cards iniciam como desconectados até que os celulares reconectem via Socket.IO com seu `deviceId`.
- Desconexões normais (`disconnect`) e quedas de rede (heartbeat timeout) devem atualizar imediatamente o card correspondente no Dashboard.

### 3.4 Persistência Local
- Dados persistidos: `id`, `name`, `description`, `createdAt`, `pairedDeviceId` (opcional).
- O backend deve implementar o Repository Pattern para permitir troca transparente de storage (JSON com atomic write ou SQLite).
- A persistência deve sobreviver ao encerramento e reinicialização do processo Node.js.

### 3.5 Operação em Rede Local Wi-Fi
- O servidor escuta explicitamente na interface `0.0.0.0` (todas as interfaces de rede).
- Os dispositivos móveis e o computador operam conectados à **mesma rede Wi-Fi com acesso à internet**, o que garante estabilidade de tráfego local, impede o Android de descartar o Wi-Fi em favor de dados móveis e dispensa dependências de serviços de nuvem de terceiros (como Firebase/FCM).
- Nunca utilizar hardcoded `localhost` ou `127.0.0.1` em URLs que precisam ser acessadas pelo celular.
- Deve haver instruções claras de liberação de porta no Firewall do Windows.

### 3.6 Cliente Android Nativo em Segundo Plano e Alerta com Tela Desligada
- **Execução em Segundo Plano**: Utiliza um `Foreground Service` (`PhoneFinderForegroundService`) com notificação contínua de baixa prioridade (`IMPORTANCE_LOW`), mantendo a conexão Socket.IO viva mesmo quando o app não estiver visível.
- **Prevenção de Suspensão de Wi-Fi e CPU**: O serviço aloca `PARTIAL_WAKE_LOCK` e `WifiManager.WifiLock` (`WIFI_MODE_FULL_HIGH_PERF`) para evitar queda de rádio Wi-Fi durante o modo de repouso (Doze Mode).
- **Acendimento de Tela Desligada / Bloqueada**:
  - Ao receber o evento `alert:locate`, o serviço despacha uma notificação de alta prioridade (`IMPORTANCE_HIGH`, `CATEGORY_ALARM`) associada a um `Full-Screen Intent (FSI)`.
  - A Activity `LocateAlertActivity` está configurada com `showWhenLocked="true"`, `turnScreenOn="true"` e solicita a liberação temporária da tela de bloqueio (`requestDismissKeyguard`), garantindo que o display acenda e projete imediatamente o fundo 100% vermelho (#FF0000).
- **Alertas Combinados (Visual + Sonoro + Vibração)**:
  - **Visual**: Tela 100% vermelha `#FF0000` em tela cheia imersiva (sem barras do sistema) por exatamente 5 segundos.
  - **Sonoro**: Reprodução de toque de alarme via `STREAM_ALARM` (`AudioAttributes.USAGE_ALARM`), garantindo toque audível mesmo que o celular esteja em modo silencioso ou vibracall.
  - **Vibração**: Padrão de pulso contínuo via `Vibrator` durante o ciclo de 5 segundos.
- **Encerramento Automático**: Após 5000ms, o som e vibração são imediatamente interrompidos e a Activity fecha-se de forma limpa, restaurando o estado original do aparelho.

---

## 4. Critérios de Aceitação Obrigatórios

1. Cadastro de dois ou mais cards com nomes distintos no dashboard.
2. Geração de código de pareamento numérico de 6 dígitos no servidor com validade de 5 min.
3. Acesso ao receptor pelo navegador do celular (/receiver) ou aplicativo Android APK na rede Wi-Fi local.
4. Vinculação correta entre o celular que digitou o código e o card correspondente.
5. Código invalidado imediatamente após o uso ou após expirar.
6. Dashboard reflete com precisão o estado online/offline dos celulares.
7. Ao clicar em "Localizar celular" no card A, somente o celular A reage.
8. Celular exibe tela 100% vermelha por 5 segundos e retorna ao normal.
9. No aplicativo Android, o alarme funciona em segundo plano mesmo com a tela apagada/bloqueada, acendendo o display em vermelho com som e vibração.
10. Card desconectado mantém o botão desabilitado e bloqueia envios indevidos.
11. Feedback visual claro de erro, carregamento, sucesso e estados vazios.
12. Dados dos cards permanecem salvos após reinicialização do servidor.
13. Exclusão e renomeação de cards funcionando com confirmação antes da remoção.
14. Operação em rede Wi-Fi com internet sem dependência de serviços externos em nuvem.
15. Documentação completa de execução, firewall e testes no README.

