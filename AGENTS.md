# Phone Finder — Contexto e Diretrizes do Projeto

Consulte a documentação completa e os padrões operacionais em [.agents/AGENTS.md](file:///c:/Users/mfana/projetos/phoneFinder/.agents/AGENTS.md).

## Resumo Executivo
O **Phone Finder** é uma aplicação voltada para localização visual de celulares físicos em rede Wi-Fi local sem dependências de nuvem.

### Tecnologias Principais
- **Frontend**: React + TypeScript + Vite + Socket.IO Client + CSS Vanilla responsivo.
- **Backend**: Node.js + Express + TypeScript + Socket.IO + Persistência Local.
- **Receptores**: Web (`/receiver`) para testes rápidos no celular e App Android Nativo em Kotlin.
- **Arquitetura**: Monorepo com pacote `shared` de contratos e tipagens.

### Regras Centrais
1. **Rede Local**: Bind em `0.0.0.0`, sem dependência de internet durante o uso.
2. **Pareamento Seguro**: Código de 6 dígitos numéricos, expira em 5 min, uso único, gerado no servidor.
3. **Comando Direcionado**: Disparo de tela 100% vermelha por 5 segundos com prevenção de duplicidade (`commandId`).
4. **Persistência**: Cards e vínculos persistem entre reinicializações do servidor; status de conexão é estritamente em tempo real (em memória).
