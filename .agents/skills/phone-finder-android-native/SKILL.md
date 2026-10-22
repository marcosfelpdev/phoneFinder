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

## 2. Implementação do Alerta Visual de 5 Segundos

Ao receber o evento `alert:locate`:
```kotlin
socket.on("alert:locate") { args ->
    val payload = args[0] as JSONObject
    val commandId = payload.getString("commandId")
    val durationMs = payload.optLong("durationMs", 5000L)

    // Enviar ACK imediato
    val ack = JSONObject().apply {
        put("commandId", commandId)
        put("status", "ok")
    }
    socket.emit("alert:ack", ack)

    // Acionar a tela vermelha na thread de UI
    runOnUiThread {
        showRedScreen(durationMs)
    }
}

private fun showRedScreen(durationMs: Long) {
    binding.fullScreenRedOverlay.visibility = View.VISIBLE
    lifecycleScope.launch {
        delay(durationMs)
        binding.fullScreenRedOverlay.visibility = View.GONE
    }
}
```

## 3. Diretrizes de Ciclo de Vida e Segurança
- O app deve priorizar o funcionamento em **primeiro plano** com `FLAG_KEEP_SCREEN_ON`.
- Evitar prometer sobreposição de tela com o aparelho bloqueado sem permissão explícita de `SYSTEM_ALERT_WINDOW` e conformidade com as restrições do Google Play para Android 10+.

Consulte a arquitetura completa em [references/android-architecture.md](./references/android-architecture.md).
