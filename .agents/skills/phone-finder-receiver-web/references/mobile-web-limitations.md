# Limitações e Comportamento do Receptor Web Mobile

## 1. Escopo do Receptor Web
O receptor web (`/receiver`) foi projetado para:
- Testes imediatos sem instalação de APK.
- Validação rápida do protocolo de pareamento e localização na rede Wi-Fi local.
- Operação em navegadores modernos de smartphones (Chrome Android, Safari iOS, Samsung Internet).

## 2. Limitações Técnicas Conhecidas
1. **Segundo Plano e Tela Bloqueada**:
   - Navegadores móveis suspendem ou reduzem a frequência de execução de timers JavaScript e conexões WebSocket quando a aba entra em segundo plano ou quando o usuário bloqueia a tela do aparelho.
   - Portanto, a versão web exige explicitamente que o navegador permaneça com a aba aberta em primeiro plano.
   - A interface do `/receiver` deve exibir um aviso claro e educativo: *"Mantenha esta aba aberta na tela para receber os comandos de localização."*
2. **Screen Wake Lock API**:
   - Para evitar que o celular apague a tela por inatividade enquanto aguarda comandos na bancada de trabalho, o receptor deve tentar ativar a API padrão `navigator.wakeLock.request('screen')`.
   - Se a Wake Lock API não for suportada pelo navegador ou for revogada (ex.: usuário alternou de app), o receptor deve tratar graciosamente sem travar.
3. **Área Segura e Modo Imersivo**:
   - O modo de tela vermelha deve cobrir 100% da viewport, utilizando `100vw`, `100dvh` (dynamic viewport height) e respeitando `env(safe-area-inset-top)` / `bottom` para preencher até os recortes de câmera/notch.
   - Zero elementos de texto, ícones ou botões durante o alerta vermelho para máxima visibilidade à distância.
