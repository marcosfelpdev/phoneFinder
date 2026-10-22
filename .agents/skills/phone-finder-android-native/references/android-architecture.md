# Arquitetura do Aplicativo Android Nativo — Phone Finder

## 1. Stack e Bibliotecas Recomendadas
- **Linguagem**: Kotlin (Gradle Kotlin DSL `build.gradle.kts`).
- **Android Min SDK**: 24 (Android 7.0 Nougat).
- **Android Target SDK**: 34 ou 35.
- **Comunicação em Tempo Real**: `io.socket:socket.io-client:2.1.1` (cliente Socket.IO oficial para Java/Kotlin).
- **Armazenamento de Identidade**: `SharedPreferences` ou `EncryptedSharedPreferences` para armazenar `device_id` e a URL do servidor local.
- **UI**: Android Views com layout XML ou Jetpack Compose.

## 2. Ciclo de Vida e Tela Vermelha
1. **Manter Tela Ligada**:
   - Uso de `window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)` na Activity para evitar suspensão de tela durante o uso em bancada.
2. **Imersão Total na Tela Vermelha**:
   - `WindowInsetsControllerCompat` para ocultar temporariamente a barra de status e a barra de navegação durante o disparo dos 5 segundos, garantindo tela 100% preenchida de vermelho `#FF0000`.
3. **Gerenciamento de Coroutine / Handler**:
   - Ao receber `alert:locate`:
     - Disparar `alert:ack` imediato.
     - Mudar background para `#FF0000` na thread principal (`Dispatchers.Main`).
     - Iniciar delay de 5000ms.
     - Restaurar cor de fundo e visibilidade do estado de monitoramento.

## 3. Estrutura de Pastas do Módulo Android
```text
apps/android/
├── app/
│   ├── build.gradle.kts
│   └── src/main/
│       ├── AndroidManifest.xml
│       ├── java/com/phonefinder/
│       │   ├── MainActivity.kt
│       │   ├── data/
│       │   │   ├── DevicePreferences.kt
│       │   │   └── SocketService.kt
│       │   └── ui/
│       │       └── PairingActivity.kt
│       └── res/
│           ├── layout/
│           └── values/
├── build.gradle.kts
└── settings.gradle.kts
```
