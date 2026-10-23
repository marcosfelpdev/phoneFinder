package com.phonefinder.service

import android.annotation.SuppressLint
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.PowerManager
import android.util.Log
import com.phonefinder.data.DevicePreferences

/**
 * Receiver acionado periodicamente via AlarmManager (RTC Wakeup) para acordar
 * a CPU mesmo em modo Deep Doze, inspecionar a integridade da conexão do socket
 * e disparar reconexões proativas em segundo plano sem depender da abertura do app.
 */
class KeepAliveReceiver : BroadcastReceiver() {

    @SuppressLint("WakelockTimeout")
    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action ?: ACTION_KEEP_ALIVE
        Log.d(TAG, "KeepAliveReceiver acionado (Ação: $action)")

        val powerManager = context.getSystemService(Context.POWER_SERVICE) as PowerManager
        val wakeLock = powerManager.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK,
            "PhoneFinder::KeepAliveWakeLock"
        )
        // Mantém a CPU acordada por tempo suficiente (máx 15 segundos) para executar o teste e a reconexão
        wakeLock.acquire(15_000L)

        try {
            val preferences = DevicePreferences(context)
            if (!preferences.isForegroundServiceEnabled) {
                Log.d(TAG, "Foreground service desativado pelo usuário. Ignorando evento.")
                return
            }

            val service = PhoneFinderForegroundService.instance
            if (service != null) {
                // Reagenda o próximo alarme periódico para manter o ciclo de vida vivo
                service.scheduleKeepAliveAlarm()

                // Se houver aparelho pareado e o socket estiver desconectado, reconecta proativamente
                if (preferences.deviceId != null && !PhoneFinderForegroundService.isConnected) {
                    Log.w(TAG, "Watchdog RTC: socket desconectado em repouso. Reconectando proativamente em 2º plano...")
                    service.reconnectSocket()
                }
            } else {
                // Se o ForegroundService foi encerrado pelo SO por falta de memória, recria o serviço
                Log.w(TAG, "ForegroundService não estava em execução. Reiniciando serviço em segundo plano...")
                PhoneFinderForegroundService.start(context)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Erro no processamento do KeepAliveReceiver", e)
        } finally {
            try {
                if (wakeLock.isHeld) {
                    wakeLock.release()
                }
            } catch (_: Exception) {}
        }
    }

    companion object {
        private const val TAG = "KeepAliveReceiver"
        const val ACTION_KEEP_ALIVE = "com.phonefinder.action.KEEP_ALIVE"
    }
}
