# Arquitetura do Aplicativo Android Nativo — Phone Finder

## 1. Stack e Bibliotecas Recomendadas
- **Linguagem**: Kotlin (Gradle Kotlin DSL `build.gradle.kts`).
- **Android Min SDK**: 24 (Android 7.0 Nougat).
- **Android Target SDK**: 35 (Android 15).
- **Comunicação em Tempo Real**: `io.socket:socket.io-client:2.1.1` (cliente Socket.IO oficial para Java/Kotlin).
- **Armazenamento de Identidade**: `SharedPreferences` para armazenar `device_id`, URL do servidor local e preferências de alerta.
- **UI**: Android Views com ViewBinding e Material Components.

## 2. Ciclo de Vida em Segundo Plano e Despertar de Tela
1. **Foreground Service Contínuo (`PhoneFinderForegroundService`)**:
   - Mantém o Socket.IO ativo no ciclo de vida do sistema operacional através de uma notificação persistente (`IMPORTANCE_LOW`).
   - Evita descarte de conexão e timeout de heartbeat durante o repouso.
2. **Prevenção de Repouso de Wi-Fi e CPU**:
   - `PowerManager.PARTIAL_WAKE_LOCK`: Mantém a CPU ativa para processamento de pacotes do socket.
   - `WifiManager.WifiLock` com `WIFI_MODE_FULL_HIGH_PERF`: Mantém a interface Wi-Fi ligada e em alta performance.
3. **Despertar com Tela Apagada / Bloqueada**:
   - Utiliza `Full-Screen Intent (FSI)` via `NotificationCompat.Builder` configurado com `CATEGORY_ALARM` e `PRIORITY_MAX` em um NotificationChannel de alta importância.
   - A Activity `LocateAlertActivity` é iniciada sobre a Lock Screen via `setShowWhenLocked(true)`, `setTurnScreenOn(true)` e `KeyguardManager.requestDismissKeyguard()`.
4. **Alerta Multissensorial de 5 Segundos**:
   - **Visual**: Fundo 100% vermelho `#FF0000`, tela cheia imersiva (sem barras de navegação ou status).
   - **Sonoro**: Toque de alarme padrão do sistema via `STREAM_ALARM` (`AudioAttributes.USAGE_ALARM`), contornando o modo silencioso/não perturbe.
   - **Vibração**: Padrão de vibração contínuo durante os 5000ms.
5. **Encerramento Automático**:
   - O temporizador encerra a reprodução sonora, cessa a vibração e finaliza a Activity após 5000ms exatos, devolvendo o aparelho ao estado original.

## 3. Estrutura de Pastas do Módulo Android
```text
apps/android/app/src/main/
├── AndroidManifest.xml
├── java/com/phonefinder/
│   ├── MainActivity.kt                  # Interface de pareamento, status e opções
│   ├── data/
│   │   ├── DevicePreferences.kt         # Persistência SharedPreferences
│   │   └── SocketManager.kt             # Cliente Socket.IO e eventos de protocolo
│   ├── service/
│   │   └── PhoneFinderForegroundService.kt # Serviço em 2º plano com Socket e Locks
│   ├── ui/
│   │   ├── LocateAlertActivity.kt       # Activity de alerta vermelho e despertar
│   │   └── FullscreenHelper.kt          # Imersão total de tela cheia
│   └── util/
│       └── SoundAndVibrationHelper.kt   # Controle de áudio de alarme e vibração
└── res/
    ├── layout/
    │   ├── activity_main.xml
    │   └── activity_locate_alert.xml
    └── values/
        ├── colors.xml
        ├── strings.xml
        └── themes.xml
```

