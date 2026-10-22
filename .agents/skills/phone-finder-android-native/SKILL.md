---
name: phone-finder-android-native
description: >-
  Guides the creation, configuration, and maintenance of the native Android Kotlin client
  for Phone Finder using the official Socket.IO Java/Kotlin client.
  Use when developing, testing, or troubleshooting the native Android application.
---

# Phone Finder Android Native Standard

Esta skill padroniza a implementação do cliente móvel nativo em Kotlin para o Phone Finder.

## 1. Configuração do Socket.IO no Android

No `app/build.gradle.kts`:
```kotlin
dependencies {
    implementation("io.socket:socket.io-client:2.1.1") {
        exclude(group = "org.json", module = "json")
    }
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.0")
}
```

No `AndroidManifest.xml`:
```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
<uses-permission android:name="android.permission.WAKE_LOCK" />

<!-- Permitir tráfego HTTP local (sem SSL obrigatório na LAN) -->
<application
    android:usesCleartextTraffic="true"
    ...>
```

## 2. Padrão de Execução em Segundo Plano (Foreground Service)

Para manter a conexão Socket.IO viva sem sofrer encerramento pelo Doze Mode do Android:
1. Um `PhoneFinderForegroundService` é mantido ativo com uma notificação contínua (`IMPORTANCE_LOW`).
2. O serviço segura um `PARTIAL_WAKE_LOCK` e um `WifiLock` (`WIFI_MODE_FULL_HIGH_PERF`).
3. Ao receber `alert:locate`:
   - Emite `alert:ack` imediato com `commandId`.
   - Aciona imediatamente o `LocateAlertController`, que executa de forma autônoma (sem esperar Activity):
     - Som de alarme em `STREAM_ALARM` com volume máximo temporário.
     - Vibração com atributos de alarme (`VibrationAttributes.USAGE_ALARM`).
     - Acendimento do display via `PowerManager.ACQUIRE_CAUSES_WAKEUP`.
     - Desenho de tela 100% vermelha (#FF0000) por sobreposição (`TYPE_APPLICATION_OVERLAY`).
   - Dispara notificação de alta importância com `setFullScreenIntent` para cobrir a tela de bloqueio via `LocateAlertActivity`.

## 3. Despertar de Tela Apagada e Bloqueada (`LocateAlertActivity`)

No `AndroidManifest.xml`:
```xml
<activity
    android:name=".ui.LocateAlertActivity"
    android:exported="false"
    android:showWhenLocked="true"
    android:turnScreenOn="true"
    android:launchMode="singleInstance"
    android:excludeFromRecents="true"
    android:theme="@style/Theme.PhoneFinder.Alert" />
```

No `onCreate()` da `LocateAlertActivity`:
```kotlin
if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
    setShowWhenLocked(true)
    setTurnScreenOn(true)
    val keyguardManager = getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager
    keyguardManager.requestDismissKeyguard(this, null)
} else {
    @Suppress("DEPRECATION")
    window.addFlags(
        WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
        WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
        WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
    )
}

// Tela 100% vermelha por 5 segundos
lifecycleScope.launch {
    delay(durationMs)
    finish()
}
```

## 4. Alertas Sonoros e Vibração (`SoundAndVibrationHelper`)
- **Som**: Usa `RingtoneManager` ou `MediaPlayer` associado a `AudioAttributes.USAGE_ALARM` para garantir que o som toque mesmo em modo não perturbe / silencioso.
- **Vibração**: `Vibrator` com padrão contínuo ou pulsado pelo tempo de duração do alerta (5 segundos).

Consulte a arquitetura completa em [references/android-architecture.md](./references/android-architecture.md).
Para gerar, instalar e configurar o APK nos celulares, siga [references/build-apk.md](./references/build-apk.md).

