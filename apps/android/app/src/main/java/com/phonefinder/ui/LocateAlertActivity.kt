package com.phonefinder.ui

import android.app.KeyguardManager
import android.content.Context
import android.os.Build
import android.os.Bundle
import android.view.WindowManager
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.phonefinder.R
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/**
 * Tela 100% vermelha exibida sobre a tela de bloqueio (aberta via Full-Screen Intent).
 *
 * Som, vibração e acendimento do display são controlados pelo LocateAlertController,
 * iniciado diretamente pelo Foreground Service — assim o alerta sonoro não depende
 * desta Activity conseguir ser aberta pelo sistema.
 */
class LocateAlertActivity : AppCompatActivity() {

    private var alertJob: Job? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Configurar o acendimento e desbloqueio visual da tela mesmo bloqueada
        configureScreenWake()

        setContentView(R.layout.activity_locate_alert)

        // Modo imersivo absoluto (sem status bar ou navigation bar)
        FullscreenHelper.enterImmersiveRedScreen(this)

        val durationMs = intent.getLongExtra(EXTRA_DURATION_MS, DEFAULT_DURATION_MS)

        // Temporizador de 5 segundos exatos para encerrar o alerta e restaurar o estado original
        alertJob = lifecycleScope.launch {
            delay(durationMs)
            finishAlert()
        }
    }

    private fun configureScreenWake() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
            val keyguardManager = getSystemService(Context.KEYGUARD_SERVICE) as? KeyguardManager
            keyguardManager?.requestDismissKeyguard(this, null)
        } else {
            @Suppress("DEPRECATION")
            window.addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
                WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
            )
        }

        // Manter a tela ligada com brilho máximo durante o alerta
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        val layoutParams = window.attributes
        layoutParams.screenBrightness = WindowManager.LayoutParams.BRIGHTNESS_OVERRIDE_FULL
        window.attributes = layoutParams
    }

    private fun finishAlert() {
        FullscreenHelper.exitImmersiveRedScreen(this)
        finish()
    }

    override fun onDestroy() {
        super.onDestroy()
        alertJob?.cancel()
    }

    companion object {
        const val EXTRA_DURATION_MS = "extra_duration_ms"
        const val DEFAULT_DURATION_MS = 5000L
    }
}
