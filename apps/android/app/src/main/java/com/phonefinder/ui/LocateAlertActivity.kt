package com.phonefinder.ui

import android.app.KeyguardManager
import android.content.Context
import android.os.Build
import android.os.Bundle
import android.view.WindowManager
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.phonefinder.R
import com.phonefinder.util.SoundAndVibrationHelper
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

class LocateAlertActivity : AppCompatActivity() {

    private lateinit var soundAndVibrationHelper: SoundAndVibrationHelper
    private var alertJob: Job? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Configurar o acendimento e desbloqueio visual da tela mesmo bloqueada
        configureScreenWake()

        setContentView(R.layout.activity_locate_alert)

        // Modo imersivo absoluto (sem status bar ou navigation bar)
        FullscreenHelper.enterImmersiveRedScreen(this)

        soundAndVibrationHelper = SoundAndVibrationHelper(this)

        val durationMs = intent.getLongExtra(EXTRA_DURATION_MS, DEFAULT_DURATION_MS)
        val enableSound = intent.getBooleanExtra(EXTRA_ENABLE_SOUND, true)
        val enableVibrate = intent.getBooleanExtra(EXTRA_ENABLE_VIBRATE, true)

        // Iniciar toque de alarme e padrão de vibração
        soundAndVibrationHelper.start(enableSound = enableSound, enableVibrate = enableVibrate)

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
        soundAndVibrationHelper.stop()
        FullscreenHelper.exitImmersiveRedScreen(this)
        finish()
    }

    override fun onDestroy() {
        super.onDestroy()
        alertJob?.cancel()
        soundAndVibrationHelper.stop()
    }

    companion object {
        const val EXTRA_DURATION_MS = "extra_duration_ms"
        const val EXTRA_ENABLE_SOUND = "extra_enable_sound"
        const val EXTRA_ENABLE_VIBRATE = "extra_enable_vibrate"
        const val DEFAULT_DURATION_MS = 5000L
    }
}
