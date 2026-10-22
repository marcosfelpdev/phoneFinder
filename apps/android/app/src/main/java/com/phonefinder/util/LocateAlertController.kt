package com.phonefinder.util

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Color
import android.graphics.PixelFormat
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.provider.Settings
import android.util.Log
import android.view.View
import android.view.WindowManager

/**
 * Orquestra o alerta "Localizar celular" diretamente a partir do processo
 * (Foreground Service), sem depender de nenhuma Activity ser aberta:
 *
 * 1. Acende a tela (wake lock com ACQUIRE_CAUSES_WAKEUP).
 * 2. Toca o alarme e vibra (SoundAndVibrationHelper).
 * 3. Desenha uma camada 100% vermelha sobre qualquer app (TYPE_APPLICATION_OVERLAY),
 *    quando a permissão "Sobrepor a outros apps" está concedida.
 * 4. Encerra tudo automaticamente após [durationMs].
 *
 * A LocateAlertActivity (aberta via Full-Screen Intent) continua sendo usada para
 * exibir o vermelho sobre a tela de bloqueio; ela NÃO controla mais o som.
 */
object LocateAlertController {

    private const val TAG = "LocateAlertController"

    private val mainHandler = Handler(Looper.getMainLooper())
    private var soundHelper: SoundAndVibrationHelper? = null
    private var screenWakeLock: PowerManager.WakeLock? = null
    private var overlayView: View? = null
    private var stopRunnable: Runnable? = null

    @Volatile
    var isActive: Boolean = false
        private set

    fun start(
        context: Context,
        durationMs: Long,
        enableSound: Boolean,
        enableVibrate: Boolean,
        enableRedOverlay: Boolean
    ) {
        val appContext = context.applicationContext
        mainHandler.post {
            // Reinicia caso um alerta anterior ainda esteja ativo
            stopInternal(appContext)
            isActive = true

            wakeScreen(appContext, durationMs)

            soundHelper = SoundAndVibrationHelper(appContext).also {
                it.start(enableSound = enableSound, enableVibrate = enableVibrate)
            }

            if (enableRedOverlay) {
                showRedOverlay(appContext)
            }

            val runnable = Runnable { stopInternal(appContext) }
            stopRunnable = runnable
            mainHandler.postDelayed(runnable, durationMs)
        }
    }

    fun stop(context: Context) {
        val appContext = context.applicationContext
        mainHandler.post { stopInternal(appContext) }
    }

    @SuppressLint("WakelockTimeout")
    private fun wakeScreen(context: Context, durationMs: Long) {
        try {
            val powerManager = context.getSystemService(Context.POWER_SERVICE) as PowerManager
            // SCREEN_BRIGHT_WAKE_LOCK está depreciado, mas continua sendo a única forma de um
            // serviço acender o display sem uma Activity. O timeout garante a liberação.
            @Suppress("DEPRECATION")
            screenWakeLock = powerManager.newWakeLock(
                PowerManager.SCREEN_BRIGHT_WAKE_LOCK or
                    PowerManager.ACQUIRE_CAUSES_WAKEUP or
                    PowerManager.ON_AFTER_RELEASE,
                "PhoneFinder::LocateScreenWake"
            ).apply {
                setReferenceCounted(false)
                acquire(durationMs + 1_000L)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Erro ao acender a tela", e)
        }
    }

    private fun showRedOverlay(context: Context) {
        if (!AlertPermissions.canDrawOverlays(context)) {
            Log.w(TAG, "Sem permissão de sobreposição; camada vermelha não será desenhada.")
            return
        }
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            // TYPE_APPLICATION_OVERLAY só existe a partir do Android 8; em versões
            // anteriores a LocateAlertActivity cobre o caso.
            return
        }

        try {
            val windowManager = context.getSystemService(Context.WINDOW_SERVICE) as WindowManager

            @Suppress("DEPRECATION")
            val params = WindowManager.LayoutParams(
                WindowManager.LayoutParams.MATCH_PARENT,
                WindowManager.LayoutParams.MATCH_PARENT,
                WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                    WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
                    WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS or
                    WindowManager.LayoutParams.FLAG_FULLSCREEN or
                    WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON or
                    WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
                    WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED,
                PixelFormat.OPAQUE
            ).apply {
                screenBrightness = WindowManager.LayoutParams.BRIGHTNESS_OVERRIDE_FULL
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    layoutInDisplayCutoutMode =
                        WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS
                } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                    layoutInDisplayCutoutMode =
                        WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
                }
            }

            val view = View(context).apply {
                setBackgroundColor(Color.RED) // #FF0000
            }

            windowManager.addView(view, params)
            overlayView = view
        } catch (e: Exception) {
            Log.e(TAG, "Erro ao desenhar camada vermelha", e)
            overlayView = null
        }
    }

    private fun removeRedOverlay(context: Context) {
        val view = overlayView ?: return
        try {
            val windowManager = context.getSystemService(Context.WINDOW_SERVICE) as WindowManager
            windowManager.removeViewImmediate(view)
        } catch (e: Exception) {
            Log.e(TAG, "Erro ao remover camada vermelha", e)
        } finally {
            overlayView = null
        }
    }

    private fun stopInternal(context: Context) {
        stopRunnable?.let { mainHandler.removeCallbacks(it) }
        stopRunnable = null

        soundHelper?.stop()
        soundHelper = null

        removeRedOverlay(context)

        try {
            screenWakeLock?.let { if (it.isHeld) it.release() }
        } catch (e: Exception) {
            Log.e(TAG, "Erro ao liberar wake lock de tela", e)
        } finally {
            screenWakeLock = null
        }

        isActive = false
    }
}

/**
 * Verificações das permissões especiais necessárias para o alerta funcionar com o
 * app em segundo plano / tela apagada.
 */
object AlertPermissions {

    fun canDrawOverlays(context: Context): Boolean =
        Build.VERSION.SDK_INT < Build.VERSION_CODES.M || Settings.canDrawOverlays(context)

    fun canUseFullScreenIntent(context: Context): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.UPSIDE_DOWN_CAKE) return true
        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE)
            as android.app.NotificationManager
        return nm.canUseFullScreenIntent()
    }

    val isXiaomiFamily: Boolean
        get() {
            val manufacturer = Build.MANUFACTURER.lowercase()
            return manufacturer.contains("xiaomi") ||
                manufacturer.contains("redmi") ||
                manufacturer.contains("poco")
        }
}
