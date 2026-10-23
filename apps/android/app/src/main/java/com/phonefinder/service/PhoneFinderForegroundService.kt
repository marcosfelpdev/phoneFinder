package com.phonefinder.service

import android.annotation.SuppressLint
import android.app.KeyguardManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.net.wifi.WifiManager
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import android.util.Log
import androidx.core.app.NotificationCompat
import com.phonefinder.MainActivity
import com.phonefinder.R
import com.phonefinder.data.DevicePreferences
import com.phonefinder.data.SocketManager
import com.phonefinder.ui.LocateAlertActivity
import com.phonefinder.util.AlertPermissions
import com.phonefinder.util.LocateAlertController
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

class PhoneFinderForegroundService : Service() {

    private lateinit var preferences: DevicePreferences
    private lateinit var socketManager: SocketManager
    private lateinit var notificationManager: NotificationManager

    private var wakeLock: PowerManager.WakeLock? = null
    private var wifiLock: WifiManager.WifiLock? = null
    private val processedCommands = HashSet<String>()

    private val serviceScope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private var watchdogJob: Job? = null

    override fun onCreate() {
        super.onCreate()
        preferences = DevicePreferences(this)
        socketManager = SocketManager(preferences)
        notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        instance = this

        createNotificationChannels()
        acquireLocks()
        setupSocketListeners()
        startWatchdog()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val action = intent?.action ?: ACTION_START

        when (action) {
            ACTION_STOP -> {
                stopForegroundService()
                return START_NOT_STICKY
            }
            ACTION_RECONNECT -> {
                socketManager.connect(preferences.serverUrl)
            }
            ACTION_START -> {
                startForegroundWithNotification()
                socketManager.connect(preferences.serverUrl)
            }
        }

        return START_STICKY
    }

    private fun startForegroundWithNotification() {
        val notification = buildServiceNotification("Conectando ao servidor...")

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(
                NOTIFICATION_SERVICE_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE
            )
        } else {
            startForeground(NOTIFICATION_SERVICE_ID, notification)
        }
    }

    private fun buildServiceNotification(statusText: String): Notification {
        val openAppIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP
        }

        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            openAppIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val cardName = preferences.cardName ?: "Aparelho não pareado"

        return NotificationCompat.Builder(this, CHANNEL_SERVICE_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("Phone Finder — $cardName")
            .setContentText(statusText)
            .setOngoing(true)
            .setContentIntent(pendingIntent)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .build()
    }

    private fun updateServiceNotification(statusText: String) {
        val notification = buildServiceNotification(statusText)
        notificationManager.notify(NOTIFICATION_SERVICE_ID, notification)
    }

    private fun setupSocketListeners() {
        socketManager.onConnectionChanged = { isConnected ->
            val status = if (isConnected) "● Conectado na rede Wi-Fi" else "● Reconectando ao servidor..."
            updateServiceNotification(status)
            onConnectionStateListener?.invoke(isConnected)
        }

        socketManager.onPairingResult = { success, deviceId, cardName, error ->
            if (success && deviceId != null) {
                preferences.deviceId = deviceId
                preferences.cardName = cardName
                updateServiceNotification("● Conectado — $cardName")
            }
            onPairingResultListener?.invoke(success, deviceId, cardName, error)
        }

        socketManager.onAlertLocate = { commandId, durationMs ->
            handleAlertLocate(commandId, durationMs)
        }

        socketManager.onDeviceUnpaired = {
            preferences.clearDevice()
            updateServiceNotification("● Aparelho desvinculado")
            onDeviceUnpairedListener?.invoke()
        }
    }

    /**
     * Processa o comando de localização.
     *
     * O som, a vibração, o acendimento da tela e a camada vermelha são disparados
     * IMEDIATAMENTE pelo próprio serviço (LocateAlertController). Antes, tudo isso só
     * acontecia no onCreate() da LocateAlertActivity — e o Android não abre essa
     * Activity quando o usuário está com a tela ligada (o Full-Screen Intent vira apenas
     * uma notificação heads-up) nem quando a permissão de tela cheia está negada
     * (padrão no Android 14+ / HyperOS). Resultado: nada tocava até a notificação ser tocada.
     */
    private fun handleAlertLocate(commandId: String, durationMs: Long) {
        if (processedCommands.contains(commandId)) {
            Log.d(TAG, "Comando $commandId já processado. Ignorando duplicata.")
            return
        }
        processedCommands.add(commandId)

        // Enviar ACK imediato ao servidor
        socketManager.sendAlertAck(commandId)

        val screenRedEnabled = preferences.isScreenRedEnabled
        val canOverlay = AlertPermissions.canDrawOverlays(this)

        // Estado do aparelho ANTES de acendermos a tela
        val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
        val keyguardManager = getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager
        val wasScreenOff = !powerManager.isInteractive
        val isLocked = keyguardManager.isKeyguardLocked

        // 1) Som + vibração + tela acesa + camada vermelha (independe de Activity)
        LocateAlertController.start(
            context = this,
            durationMs = durationMs,
            enableSound = preferences.isSoundAlertEnabled,
            enableVibrate = preferences.isVibrationAlertEnabled,
            enableRedOverlay = screenRedEnabled
        )

        // 2) Activity vermelha: necessária para aparecer SOBRE a tela de bloqueio ou
        //    quando não há permissão de sobreposição para desenhar a camada vermelha.
        val needsActivity = screenRedEnabled && (wasScreenOff || isLocked || !canOverlay)

        val alertIntent = Intent(this, LocateAlertActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or
                    Intent.FLAG_ACTIVITY_CLEAR_TOP or
                    Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra(LocateAlertActivity.EXTRA_DURATION_MS, durationMs)
        }

        val fullScreenPendingIntent = PendingIntent.getActivity(
            this,
            commandId.hashCode(),
            alertIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val openAppPendingIntent = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_SINGLE_TOP
            },
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Notificação de alarme (canal silencioso: o som é tocado pelo controller)
        val builder = NotificationCompat.Builder(this, CHANNEL_ALERT_ID)
            .setSmallIcon(android.R.drawable.ic_dialog_alert)
            .setContentTitle(getString(R.string.alert_notification_title))
            .setContentText(getString(R.string.alert_notification_desc))
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setContentIntent(openAppPendingIntent)
            .setTimeoutAfter(durationMs + 1_000L)
            .setAutoCancel(true)

        if (needsActivity) {
            builder.setFullScreenIntent(fullScreenPendingIntent, true)
        }

        notificationManager.notify(NOTIFICATION_ALERT_ID, builder.build())

        // Tentativa direta: só é permitida em 2º plano quando o app possui a permissão
        // "Sobrepor a outros apps" (isenção oficial de Background Activity Launch).
        if (needsActivity && canOverlay) {
            try {
                startActivity(alertIntent)
            } catch (e: Exception) {
                Log.e(TAG, "Erro ao iniciar LocateAlertActivity diretamente", e)
            }
        }

        if (!AlertPermissions.canUseFullScreenIntent(this)) {
            Log.w(TAG, "Permissão de notificação em tela cheia NEGADA — a tela de bloqueio não exibirá o vermelho.")
        }
    }

    @SuppressLint("WakelockTimeout")
    private fun acquireLocks() {
        try {
            val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
            wakeLock = powerManager.newWakeLock(
                PowerManager.PARTIAL_WAKE_LOCK,
                "PhoneFinder::BackgroundServiceWakeLock"
            ).apply {
                acquire()
            }

            val wifiManager = applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
            val wifiLockMode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                WifiManager.WIFI_MODE_FULL_LOW_LATENCY
            } else {
                @Suppress("DEPRECATION")
                WifiManager.WIFI_MODE_FULL_HIGH_PERF
            }
            wifiLock = wifiManager.createWifiLock(
                wifiLockMode,
                "PhoneFinder::WifiLock"
            ).apply {
                setReferenceCounted(false)
                acquire()
            }
        } catch (e: Exception) {
            Log.e(TAG, "Erro ao alocar WakeLock/WifiLock", e)
        }
    }

    private fun startWatchdog() {
        watchdogJob?.cancel()
        watchdogJob = serviceScope.launch {
            while (isActive) {
                delay(20_000L) // Checagem preventiva a cada 20 segundos
                try {
                    val deviceId = preferences.deviceId
                    if (deviceId != null && !socketManager.isConnected) {
                        Log.w(TAG, "Watchdog: aparelho pareado desconectado. Reconectando ao servidor...")
                        socketManager.connect(preferences.serverUrl)
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "Erro no Watchdog de reconexão", e)
                }
            }
        }
    }

    private fun releaseLocks() {
        try {
            wakeLock?.let {
                if (it.isHeld) it.release()
            }
            wifiLock?.let {
                if (it.isHeld) it.release()
            }
        } catch (e: Exception) {
            Log.e(TAG, "Erro ao liberar WakeLock/WifiLock", e)
        } finally {
            wakeLock = null
            wifiLock = null
        }
    }

    private fun createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            // Canal para o serviço persistente
            val serviceChannel = NotificationChannel(
                CHANNEL_SERVICE_ID,
                getString(R.string.channel_service_name),
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = getString(R.string.channel_service_desc)
                setShowBadge(false)
            }

            // Canal para o alerta em tela cheia (Alta prioridade / Alarme).
            // Silencioso de propósito: som e vibração são controlados pelo
            // LocateAlertController (STREAM_ALARM em loop), evitando toque duplicado.
            val alertChannel = NotificationChannel(
                CHANNEL_ALERT_ID,
                getString(R.string.channel_alert_name),
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = getString(R.string.channel_alert_desc)
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC
                setSound(null, null)
                enableVibration(false)
                setBypassDnd(true)
            }

            // Remove o canal antigo (configurações de canal são imutáveis após criadas)
            notificationManager.deleteNotificationChannel(LEGACY_CHANNEL_ALERT_ID)

            notificationManager.createNotificationChannel(serviceChannel)
            notificationManager.createNotificationChannel(alertChannel)
        }
    }

    private fun stopForegroundService() {
        watchdogJob?.cancel()
        socketManager.disconnect()
        releaseLocks()
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    override fun onDestroy() {
        super.onDestroy()
        LocateAlertController.stop(this)
        stopForegroundService()
        if (instance === this) {
            instance = null
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    companion object {
        private const val TAG = "ForegroundService"
        const val CHANNEL_SERVICE_ID = "phone_finder_service_channel"
        const val CHANNEL_ALERT_ID = "phone_finder_alert_channel_v2"
        private const val LEGACY_CHANNEL_ALERT_ID = "phone_finder_alert_channel"
        const val NOTIFICATION_SERVICE_ID = 1001
        const val NOTIFICATION_ALERT_ID = 1002

        const val ACTION_START = "com.phonefinder.action.START"
        const val ACTION_STOP = "com.phonefinder.action.STOP"
        const val ACTION_RECONNECT = "com.phonefinder.action.RECONNECT"

        @Volatile
        var instance: PhoneFinderForegroundService? = null
            private set

        // Listeners estáticos para sincronizar com a MainActivity se estiver aberta
        var onConnectionStateListener: ((Boolean) -> Unit)? = null
        var onPairingResultListener: ((Boolean, String?, String?, String?) -> Unit)? = null
        var onDeviceUnpairedListener: (() -> Unit)? = null

        fun submitPairing(code: String): Boolean {
            val s = instance
            return if (s != null) {
                s.socketManager.submitPairingCode(code)
                true
            } else {
                false
            }
        }

        fun identifyDevice(deviceId: String) {
            instance?.socketManager?.identifyDevice(deviceId)
        }

        val isConnected: Boolean
            get() = instance?.socketManager?.isConnected == true

        fun start(context: Context) {
            val intent = Intent(context, PhoneFinderForegroundService::class.java).apply {
                action = ACTION_START
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }

        fun stop(context: Context) {
            val intent = Intent(context, PhoneFinderForegroundService::class.java).apply {
                action = ACTION_STOP
            }
            context.startService(intent)
        }

        fun reconnect(context: Context) {
            val intent = Intent(context, PhoneFinderForegroundService::class.java).apply {
                action = ACTION_RECONNECT
            }
            context.startService(intent)
        }
    }
}
