package com.phonefinder

import android.os.Bundle
import android.view.View
import android.view.WindowManager
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.phonefinder.data.DevicePreferences
import com.phonefinder.data.SocketManager
import com.phonefinder.databinding.ActivityMainBinding
import com.phonefinder.ui.FullscreenHelper
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private lateinit var preferences: DevicePreferences
    private lateinit var socketManager: SocketManager

    private val processedCommands = HashSet<String>()
    private var alertJob: Job? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        // Manter a tela do aparelho sempre ligada na bancada de trabalho
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        preferences = DevicePreferences(this)
        socketManager = SocketManager(preferences)

        setupUI()
        setupSocketListeners()

        // Iniciar conexão com o servidor local
        socketManager.connect(preferences.serverUrl)
    }

    private fun setupUI() {
        binding.edtServerUrl.setText(preferences.serverUrl)

        binding.btnConnectServer.setOnClickListener {
            val newUrl = binding.edtServerUrl.text.toString().trim()
            if (newUrl.isNotEmpty()) {
                preferences.serverUrl = newUrl
                socketManager.connect(newUrl)
            }
        }

        binding.btnSubmitPairing.setOnClickListener {
            val code = binding.edtPairingCode.text.toString().trim()
            if (code.length == 6) {
                binding.txtPairingError.visibility = View.GONE
                binding.btnSubmitPairing.isEnabled = false
                binding.btnSubmitPairing.text = "Validando código..."
                socketManager.submitPairingCode(code)
            } else {
                binding.txtPairingError.text = "O código deve conter 6 números."
                binding.txtPairingError.visibility = View.VISIBLE
            }
        }

        binding.btnUnpair.setOnClickListener {
            preferences.clearDevice()
            updateStateUI()
        }

        updateStateUI()
    }

    private fun updateStateUI() {
        val deviceId = preferences.deviceId
        if (deviceId != null) {
            binding.cardUnpaired.visibility = View.GONE
            binding.cardPaired.visibility = View.VISIBLE
            binding.txtCardName.text = preferences.cardName ?: "Celular Conectado"
            binding.txtDeviceId.text = "ID: ${deviceId.take(12)}..."
        } else {
            binding.cardUnpaired.visibility = View.VISIBLE
            binding.cardPaired.visibility = View.GONE
            binding.edtPairingCode.text.clear()
            binding.txtPairingError.visibility = View.GONE
            binding.btnSubmitPairing.isEnabled = true
            binding.btnSubmitPairing.text = getString(R.string.connect_button)
        }
    }

    private fun setupSocketListeners() {
        socketManager.onConnectionChanged = { isConnected ->
            runOnUiThread {
                if (isConnected) {
                    binding.txtConnectionStatus.text = "● Conectado (Wi-Fi)"
                    binding.txtConnectionStatus.setTextColor(getColor(R.color.accent_emerald))
                } else {
                    binding.txtConnectionStatus.text = "● Desconectado"
                    binding.txtConnectionStatus.setTextColor(getColor(R.color.text_muted))
                }
            }
        }

        socketManager.onPairingResult = { success, deviceId, cardName, error ->
            runOnUiThread {
                binding.btnSubmitPairing.isEnabled = true
                binding.btnSubmitPairing.text = getString(R.string.connect_button)

                if (success && deviceId != null) {
                    preferences.deviceId = deviceId
                    preferences.cardName = cardName
                    updateStateUI()
                } else {
                    binding.txtPairingError.text = error ?: "Código inválido ou expirado."
                    binding.txtPairingError.visibility = View.VISIBLE
                }
            }
        }

        socketManager.onAlertLocate = { commandId, durationMs ->
            // Prevenção contra execução duplicada
            if (!processedCommands.contains(commandId)) {
                processedCommands.add(commandId)

                // Enviar ACK imediatamente ao servidor
                socketManager.sendAlertAck(commandId)

                runOnUiThread {
                    triggerRedScreen(durationMs)
                }
            }
        }

        socketManager.onDeviceUnpaired = {
            runOnUiThread {
                preferences.clearDevice()
                updateStateUI()
            }
        }
    }

    /**
     * Aciona a tela 100% vermelha (#FF0000) pelo tempo definido (5000ms padrão).
     */
    private fun triggerRedScreen(durationMs: Long) {
        alertJob?.cancel()

        FullscreenHelper.enterImmersiveRedScreen(this)
        binding.fullScreenRedOverlay.visibility = View.VISIBLE

        alertJob = lifecycleScope.launch {
            delay(durationMs)
            binding.fullScreenRedOverlay.visibility = View.GONE
            FullscreenHelper.exitImmersiveRedScreen(this@MainActivity)
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        socketManager.disconnect()
        alertJob?.cancel()
    }
}
