package com.phonefinder.util

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioManager
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.os.VibrationAttributes
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.util.Log

/**
 * Toca o alarme sonoro (STREAM_ALARM) e vibra o aparelho.
 *
 * Projetado para funcionar a partir do Foreground Service, sem depender de nenhuma
 * Activity visível:
 * - A vibração usa atributos de ALARME; sem eles o Android 10+ descarta vibrações
 *   solicitadas por apps em segundo plano.
 * - O volume do canal de alarme é elevado temporariamente ao máximo e restaurado no stop().
 */
class SoundAndVibrationHelper(context: Context) {

    private val appContext = context.applicationContext
    private val audioManager = appContext.getSystemService(Context.AUDIO_SERVICE) as? AudioManager
    private var mediaPlayer: MediaPlayer? = null
    private var vibrator: Vibrator? = null
    private var isPlaying = false
    private var previousAlarmVolume: Int? = null

    companion object {
        private const val TAG = "SoundVibrHelper"
    }

    init {
        vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val vibratorManager =
                appContext.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
            vibratorManager?.defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            appContext.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
        }
    }

    @Synchronized
    fun start(enableSound: Boolean, enableVibrate: Boolean) {
        if (isPlaying) return
        isPlaying = true

        if (enableSound) {
            startSound()
        }

        if (enableVibrate) {
            startVibration()
        }
    }

    private fun startSound() {
        try {
            raiseAlarmVolume()

            val alertUri: Uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
                ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
                ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)

            mediaPlayer = MediaPlayer().apply {
                setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build()
                )
                setDataSource(appContext, alertUri)
                isLooping = true
                prepare()
                start()
            }
        } catch (e: Exception) {
            Log.e(TAG, "Erro ao iniciar reprodução do alarme sonoro", e)
            mediaPlayer?.release()
            mediaPlayer = null
        }
    }

    private fun raiseAlarmVolume() {
        try {
            val am = audioManager ?: return
            val max = am.getStreamMaxVolume(AudioManager.STREAM_ALARM)
            val current = am.getStreamVolume(AudioManager.STREAM_ALARM)
            if (current < max) {
                previousAlarmVolume = current
                am.setStreamVolume(AudioManager.STREAM_ALARM, max, 0)
            }
        } catch (e: Exception) {
            Log.w(TAG, "Não foi possível ajustar o volume do alarme", e)
        }
    }

    private fun restoreAlarmVolume() {
        try {
            val previous = previousAlarmVolume ?: return
            audioManager?.setStreamVolume(AudioManager.STREAM_ALARM, previous, 0)
        } catch (e: Exception) {
            Log.w(TAG, "Não foi possível restaurar o volume do alarme", e)
        } finally {
            previousAlarmVolume = null
        }
    }

    private fun startVibration() {
        try {
            val vib = vibrator ?: return
            if (!vib.hasVibrator()) return

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val timings = longArrayOf(0, 500, 200, 500, 200)
                val amplitudes = intArrayOf(0, 255, 0, 255, 0)
                val effect = VibrationEffect.createWaveform(timings, amplitudes, 0)

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    vib.vibrate(
                        effect,
                        VibrationAttributes.createForUsage(VibrationAttributes.USAGE_ALARM)
                    )
                } else {
                    @Suppress("DEPRECATION")
                    vib.vibrate(
                        effect,
                        AudioAttributes.Builder()
                            .setUsage(AudioAttributes.USAGE_ALARM)
                            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                            .build()
                    )
                }
            } else {
                @Suppress("DEPRECATION")
                vib.vibrate(longArrayOf(0, 500, 200, 500, 200), 0)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Erro ao iniciar padrão de vibração", e)
        }
    }

    @Synchronized
    fun stop() {
        isPlaying = false

        try {
            mediaPlayer?.apply {
                if (isPlaying) {
                    stop()
                }
                release()
            }
        } catch (e: Exception) {
            Log.e(TAG, "Erro ao parar MediaPlayer", e)
        } finally {
            mediaPlayer = null
        }

        restoreAlarmVolume()

        try {
            vibrator?.cancel()
        } catch (e: Exception) {
            Log.e(TAG, "Erro ao cancelar vibrator", e)
        }
    }
}
