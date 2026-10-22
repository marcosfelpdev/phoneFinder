# Phone Finder — Localizador Visual em Rede Wi-Fi

Sistema local para identificação visual imediata de aparelhos celulares físicos em ambientes de trabalho (bancadas técnicas, depósitos, estoques ou desenvolvimento). Ao acionar a localização a partir do dashboard, a tela do celular correspondente é preenchida 100% de vermelho por 5 segundos.

**Operação 100% em rede Wi-Fi local**, sem dependência de internet ou serviços de nuvem.

---

## 1. Pré-requisitos

- **Node.js**: Versão 20+ ou 24+ LTS.
- **npm**: Versão 10+ (com suporte nativo a workspaces).
- **Rede Local**: Computador e celulares conectados ao mesmo roteador/rede Wi-Fi local.
- **Sistema Operacional**: Windows, Linux ou macOS (com portas liberadas na LAN).

---

## 2. Estrutura do Projeto

O projeto é estruturado como um monorepo com workspaces npm:

```text
phone-finder/
├── shared/            # Contratos de tipos TypeScript e catálogo de eventos Socket.IO
├── server/            # Backend Express + Socket.IO + Utilitários de LAN
├── apps/
│   ├── web/           # Frontend React 19 + Vite + Vanilla CSS moderno
│   └── android/       # Aplicativo nativo Android em Kotlin
├── .agents/           # Contexto, regras de segurança e skills padronizadas
└── README.md
```

---

## 3. Instalação e Configuração

### 3.1 Instalar Dependências
Na raiz do projeto, execute:
```bash
npm install
```

### 3.2 Variáveis de Ambiente
Copie o arquivo de exemplo para criar o `.env` (opcional, com valores padrão já funcionais):
```bash
cp .env.example .env
```
Variáveis principais:
- `PORT`: Porta do servidor backend (padrão: `3001`).
- `HOST`: Endereço de escuta (padrão: `0.0.0.0`).
- `VITE_PORT`: Porta da interface web (padrão: `3000`).

---

## 4. Inicialização do Sistema

### 4.1 Modo Desenvolvimento (Recomendado)
Inicie simultaneamente o servidor backend e o Vite dev server:
```bash
npm run dev
```
- **Dashboard Web (PC)**: [http://localhost:3000](http://localhost:3000)
- **Servidor Backend**: [http://localhost:3001](http://localhost:3001)

### 4.2 Compilação de Produção e Tipos
```bash
# Verificar tipagem TypeScript estrita em todos os pacotes
npm run check:types

# Compilar todos os pacotes para produção
npm run build
```

---

## 5. Acesso a partir do Celular na Rede Wi-Fi

1. **Descubra o IPv4 do computador**:
   Execute o script PowerShell fornecido na raiz:
   ```powershell
   powershell -ExecutionPolicy Bypass -File .agents/skills/phone-finder-validation/scripts/lan-ip-helper.ps1
   ```
   Ou via `ipconfig` no prompt do Windows.

2. **Acesse pelo navegador do celular**:
   Abra no celular conectado na mesma rede Wi-Fi a URL exibida no terminal, por exemplo:
   ```text
   http://192.168.1.4:3000/receiver
   ```

---

## 6. Configuração do Firewall no Windows

Caso o celular não consiga abrir a página no navegador, libere as portas de entrada `3000` (web) e `3001` (socket/api) no Firewall do Windows.

Abra o **PowerShell como Administrador** e execute:
```powershell
New-NetFirewallRule -DisplayName "Phone Finder LAN" -Direction Inbound -LocalPort 3000,3001 -Protocol TCP -Action Allow
```

---

## 7. Procedimento de Pareamento e Localização

1. No dashboard no computador, adicione um card clicando em **+ Adicionar celular** (ex.: "Celular Estoque 01").
2. Clique em **🔑 Parear** para gerar o código numérico de 6 dígitos (válido por 5 minutos).
3. No celular (ou em outra aba), abra a rota `/receiver` (ex.: `http://192.168.1.4:3000/receiver`) e digite o código de 6 dígitos.
4. O servidor vincula o aparelho ao card e envia a credencial persistente `deviceId`.
5. O status do card no dashboard muda imediatamente para **Conectado** em tempo real.
6. Ao clicar em **Localizar Celular**, a tela do celular correspondente é preenchida 100% de vermelho (#FF0000) por exatamente 5 segundos, retornando automaticamente ao normal com confirmação no Dashboard.

---

## 8. Receptor Web vs Aplicativo Android APK

| Recurso | Receptor Web (`/receiver`) | Aplicativo Android Nativo (APK) |
| :--- | :--- | :--- |
| **Instalação** | Nenhuma (basta acessar via navegador) | Instalação de APK local no dispositivo |
| **Execução em 2º Plano** | Limitada (navegador suspende abas em background) | **Suportada via Foreground Service** |
| **Tela Apagada / Bloqueada** | Não acende sem interação prévia | **Acende display via Full-Screen Intent** |
| **Alertas Sonoros** | Sujeito a políticas de autoplay do browser | **Toque de alarme via `STREAM_ALARM`** |
| **Vibração** | Sujeita ao suporte do navegador | **Vibração contínua/pulsada por 5 segundos** |

---

## 9. Aplicativo Android Nativo (APK em Segundo Plano)

O módulo Android nativo está localizado em `apps/android/` e foi estruturado para resolver o problema de celulares com tela apagada ou app em segundo plano:

1. **Foreground Service (`PhoneFinderForegroundService`)**:
   - Mantém uma notificação contínua no sistema (`IMPORTANCE_LOW`), prevenindo o encerramento do processo pelo Doze Mode do Android.
   - Retém `PARTIAL_WAKE_LOCK` e `WifiLock` (`WIFI_MODE_FULL_HIGH_PERF`) para assegurar que o rádio Wi-Fi continue acordado.
2. **Despertar de Tela e Alerta Visual (`LocateAlertActivity`)**:
   - Ao receber `alert:locate`, dispara uma notificação de alarme com **`Full-Screen Intent (FSI)`**.
   - A tela liga automaticamente (`turnScreenOn=true`), sobrepõe a tela de bloqueio (`showWhenLocked=true`) e exibe fundo 100% vermelho (#FF0000) por 5 segundos.
3. **Opções de Identificação**:
   - **Visual**: Fundo vermelho sem texto ou interferência visual.
   - **Sonoro**: Toque de alarme configurado em `STREAM_ALARM`, garantindo toque mesmo em modo silencioso ou não perturbe.
   - **Vibração**: Vibração pulsada durante o período de 5 segundos.
4. **Como Executar e Gerar o APK**:
   - Abra o diretório `apps/android` no **Android Studio**.
   - Sincronize as dependências via Gradle.
   - Gere o APK de depuração ou release (`Build > Build APK(s)` ou `./gradlew assembleDebug`).
   - Instale no celular e digite o código de pareamento gerado no dashboard.

