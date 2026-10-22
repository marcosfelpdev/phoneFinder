# Diretrizes de Segurança e Rede Local (LAN) — Phone Finder

## 1. Princípios de Rede Local (LAN)

### 1.1 Escopo Exclusivamente Local em Rede Wi-Fi
- O Phone Finder foi concebido para ambientes corporativos e técnicos (escritórios, bancadas de teste, estoques).
- **Sem dependência de serviços em nuvem**: A comunicação entre dashboard, servidor e aplicativos receptores é direta via Socket.IO pela rede Wi-Fi local, sem necessidade de servidores externos ou contas de terceiros (como Firebase/FCM).
- **Rede Wi-Fi com Internet**: Os dispositivos e o computador operam conectados na mesma rede Wi-Fi com internet, garantindo que os smartphones Android mantenham o rádio Wi-Fi ativo e estável (evitando o desligamento automático por falta de gateway para a internet).
- Recursos estáticos (fontes, ícones, scripts) devem ser empacotados localmente no bundle; nenhuma chamada a CDNs externas em tempo de execução é permitida.


### 1.2 Binding de Rede e Descoberta de IP
- O servidor Express e o servidor Socket.IO devem obrigatoriamente realizar o `listen` em `0.0.0.0` (todas as interfaces de rede disponíveis).
- Proibido usar apenas `localhost` ou `127.0.0.1` nas configurações do servidor.
- O servidor deve fornecer um utilitário / endpoint que liste os endereços IPv4 da máquina servidora na rede local, permitindo que o Dashboard exiba a URL exata para os celulares acessarem (ex.: `http://192.168.1.15:3000/receiver`).

### 1.3 CORS e Origens Permitidas
- Em ambiente de rede local onde portas e IPs podem variar, o CORS do Express e do Socket.IO deve ser configurado com uma função validadora de origem ou origin wildcard restrita a redes privadas (ex.: `192.168.*`, `10.*`, `172.16-31.*`, `localhost`), evitando conexões públicas indesejadas.

---

## 2. Validações e Higienização de Entradas

### 2.1 Validação de Cadastro de Cards
- Nome do celular: string obrigatória, mínimo 2 caracteres, máximo 50 caracteres, sanitizada de tags HTML.
- Descrição: opcional, máximo 150 caracteres.
- Rejeitar payloads que contenham campos não autorizados (ex.: números de telefone, operadora, IMEI).

### 2.2 Validação do Código de Pareamento
- Código de pareamento: estritamente numérico, exatamente 6 dígitos (`^\d{6}$`).
- Tratamento de tentativas excessivas (rate-limiting por IP/socket): após 5 tentativas incorretas consecutivas no mesmo socket, aplicar cooldown de 30 segundos para evitar força bruta local.

### 2.3 Prevenção contra Execução Duplicada de Comandos
- Cada comando despachado pelo dashboard deve conter um `commandId` (UUID v4) gerado pelo servidor.
- O receptor deve manter um buffer circular ou conjunto com os últimos `commandId`s recebidos e ignorar qualquer comando com ID já processado nos últimos 60 segundos.

---

## 3. Firewall do Sistema Operacional (Windows)

- Para que os celulares acessem o servidor no computador, o Firewall do Windows deve autorizar o tráfego de entrada (Inbound) nas portas utilizadas (ex.: portas 3000 e 3001).
- O projeto deve conter um script de assistência e instruções claras via PowerShell:
  ```powershell
  # Exemplo de regra para liberação no Windows Defender Firewall:
  New-NetFirewallRule -DisplayName "Phone Finder Server" -Direction Inbound -LocalPort 3000,3001 -Protocol TCP -Action Allow
  ```
