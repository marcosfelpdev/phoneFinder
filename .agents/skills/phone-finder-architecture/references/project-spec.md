# Especificação Completa do Projeto — Phone Finder

## 1. Visão Geral
Aplicação para localização visual de celulares físicos através de um computador em rede Wi-Fi local. O objetivo é identificar rapidamente aparelhos de trabalho (bancadas, estoques, suporte) sem precisar checá-los um a um.

Ao clicar no card do celular no dashboard, o computador envia um comando via Socket.IO para o celular conectado, fazendo sua tela ficar 100% vermelha por 5 segundos.

## 2. Escopo e Restrições
- **100% Rede Local**: Computador e celulares conectados à mesma rede Wi-Fi local. Zero dependência de nuvem.
- **Não cadastrar dados supérfluos**: Sem cadastro de números de telefone, operadora, chip, IMEI ou metadados de telefonia. Apenas Nome e Descrição Opcional.
- **Persistência dos Cards**: Cards e vínculos persistem a reinicializações do servidor via persistência local em arquivo ou SQLite.
- **Status de Conexão em Tempo Real**: Status online/offline refletido puramente pela presença ativa do socket.
- **Códigos de Pareamento**: Códigos numéricos de 6 dígitos gerados pelo servidor, com expiração em 5 minutos e uso único.
- **Identidade do Dispositivo**: Celular armazena identificador persistente (`deviceId`) para reconexões automáticas sem necessitar novo pareamento a cada abertura.
- **Comando "Localizar Celular"**:
  - Exclusivo para dispositivos online.
  - Endereçado unicamente ao socket do dispositivo correspondente.
  - Tela 100% vermelha (#FF0000) por exatamente 5 segundos.
  - Prevenção contra execução duplicada via `commandId`.
- **Receptor Web**: Rota `/receiver` acessível pelo navegador do celular via IPv4 da máquina servidora.
- **Cliente Android Nativo**: Projeto Android nativo em Kotlin com suporte aos mesmos contratos de eventos Socket.IO.

## 3. Estrutura Monorepo Obrigatória
```text
phone-finder/
├── apps/
│   ├── web/           # React + Vite + TypeScript (Dashboard e /receiver)
│   └── android/       # Kotlin Android Native
├── server/            # Node.js + Express + TypeScript + Socket.IO + Persistência
├── shared/            # Contratos de tipos TypeScript e eventos Socket.IO
├── package.json       # Workspaces root
├── .env.example
├── .gitignore
└── README.md
```
