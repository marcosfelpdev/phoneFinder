package com.phonefinder

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import android.provider.Settings
import android.view.View
import android.view.WindowManager
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import com.phonefinder.data.DevicePreferences
import com.phonefinder.data.SocketManager
import com.phonefinder.databinding.ActivityMainBinding
import com.phonefinder.service.PhoneFinderForegroundService
import com.phonefinder.ui.FullscreenHelper
import com.phonefinder.ui.LocateAlertActivity
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private lateinit var preferences: DevicePreferences
    private var localSocketManager: SocketManager? = null

    private val processedCommands = HashSet<String>()
    private var alertJob: Job? = null

    // Solicitador de permissão de notificação (Android 13+)
    private val notificationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { isGranted ->
        if (isGranted) {
            startOrUpdateBackgroundService()
        } else {
            Toast.makeText(
                this,
                "A permissão de notificações é necessária para alertas com a tela bloqueada.",
                Toast.LENGTH_LONG
            ).show()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        // Manter a tela do aparelho ligada quando a Activity estiver em primeiro plano
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        preferences = DevicePreferences(this)

        setupUI()
        setupListeners()

        // Verificar permissões e inicializar conexão
        if (preferences.isForegroundServiceEnabled) {
            checkNotificationPermissionAndStartService()
        } else {
            startLocalSocket()
        }
    }

    private fun setupUI() {
        binding.edtServerUrl.setText(preferences.serverUrl)

        // Configuração dos Checkboxes e Switches de Opções
        binding.switchForegroundService.isChecked = preferences.isForegroundServiceEnabled
        binding.chkScreenRed.isChecked = preferences.isScreenRedEnabled
        binding.chkSoundAlert.isChecked = preferences.isSoundAlertEnabled
        binding.chkVibrationAlert.isChecked = preferences.isVibrationAlertEnabled

        binding.switchForegroundService.setOnCheckedChangeListener { _, isChecked ->
            preferences.isForegroundServiceEnabled = isChecked
            if (isChecked) {
                stopLocalSocket()
                checkNotificationPermissionAndStartService()
            } else {
                PhoneFinderForegroundService.stop(this)
                startLocalSocket()
            }
        }

        binding.chkScreenRed.setOnCheckedChangeListener { _, isChecked ->
            preferences.isScreenRedEnabled = isChecked
        }

        binding.chkSoundAlert.setOnCheckedChangeListener { _, isChecked ->
            preferences.isSoundAlertEnabled = isChecked
        }

        binding.chkVibrationAlert.setOnCheckedChangeListener { _, isChecked ->
            preferences.isVibrationAlertEnabled = isChecked
        }

        binding.btnBatteryOptimization.setOnClickListener {
            requestIgnoreBatteryOptimization()
        }

        binding.btnConnectServer.setOnClickListener {
            val newUrl = binding.edtServerUrl.text.toString().trim()
            if (newUrl.isNotEmpty()) {
                preferences.serverUrl = newUrl
                if (preferences.isForegroundServiceEnabled) {
                    PhoneFinderForegroundService.reconnect(this)
                } else {
                    localSocketManager?.connect(newUrl)
                }
                Toast.makeText(this, "Servidor atualizado: $newUrl", Toast.LENGTH_SHORT).show()
            }
        }

        binding.btnSubmitPairing.setOnClickListener {
            val code = binding.edtPairingCode.text.toString().trim()
            if (code.length == 6) {
                binding.txtPairingError.visibility = View.GONE
                binding.btnSubmitPairing.isEnabled = false
                binding.btnSubmitPairing.text = "Validando código..."

                if (preferences.isForegroundServiceEnabled) {
                    val submitted = PhoneFinderForegroundService.submitPairing(code)
                    if (!submitted) {
                        // Se o serviço estiver iniciando, usa socket local
                        ensureLocalSocket().submitPairingCode(code)
                    }
                } else {
                    ensureLocalSocket().submitPairingCode(code)
                }
            } else {
                binding.txtPairingError.text = "O código deve conter 6 números."
                binding.txtPairingError.visibility = View.VISIBLE
            }
        }

        binding.btnUnpair.setOnClickListener {
            preferences.clearDevice()
            updateStateUI()
            if (preferences.isForegroundServiceEnabled) {
                PhoneFinderForegroundService.reconnect(this)
            } else {
                localSocketManager?.connect(preferences.serverUrl)
            }
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

    private fun setupListeners() {
        // Callbacks do Foreground Service
        PhoneFinderForegroundService.onConnectionStateListener = { isConnected ->
            runOnUiThread {
                updateConnectionUI(isConnected)
            }
        }

        PhoneFinderForegroundService.onPairingResultListener = { success, deviceId, cardName, error ->
            runOnUiThread {
                handlePairingResult(success, deviceId, cardName, error)
            }
        }

        PhoneFinderForegroundService.onDeviceUnpairedListener = {
            runOnUiThread {
                preferences.clearDevice()
                updateStateUI()
            }
        }
    }

    private fun updateConnectionUI(isConnected: Boolean) {
        if (isConnected) {
            binding.txtConnectionStatus.text = "● Conectado (Wi-Fi)"
            binding.txtConnectionStatus.setTextColor(getColor(R.color.accent_emerald))
        } else {
            binding.txtConnectionStatus.text = "● Desconectado"
            binding.txtConnectionStatus.setTextColor(getColor(R.color.text_muted))
        }
    }

    private fun handlePairingResult(
        success: Boolean,
        deviceId: String?,
        cardName: String?,
        error: String?
    ) {
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

    private fun checkNotificationPermissionAndStartService() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            val permission = Manifest.permission.POST_NOTIFICATIONS
            if (ContextCompat.checkSelfPermission(this, permission) == PackageManager.PERMISSION_GRANTED) {
                startOrUpdateBackgroundService()
            } else {
                notificationPermissionLauncher.launch(permission)
            }
        } else {
            startOrUpdateBackgroundService()
        }
    }

    private fun startOrUpdateBackgroundService() {
        PhoneFinderForegroundService.start(this)
        // Atualiza estado de conexão imediato caso já esteja conectado
        updateConnectionUI(PhoneFinderForegroundService.isConnected)
    }

    private fun ensureLocalSocket(): SocketManager {
        if (localSocketManager == null) {
            localSocketManager = SocketManager(preferences).apply {
                onConnectionChanged = { isConnected ->
                    runOnUiThread { updateConnectionUI(isConnected) }
                }
                onPairingResult = { success, deviceId, cardName, error ->
                    runOnUiThread { handlePairingResult(success, deviceId, cardName, error) }
                }
                onAlertLocate = { commandId, durationMs ->
                    handleLocalAlertLocate(commandId, durationMs)
                }
                onDeviceUnpaired = {
                    runOnUiThread {
                        preferences.clearDevice()
                        updateStateUI()
                    }
                }
            }
        }
        return localSocketManager!!
    }

    private fun startLocalSocket() {
        ensureLocalSocket().connect(preferences.serverUrl)
    }

    private fun stopLocalSocket() {
        localSocketManager?.disconnect()
        localSocketManager = null
    }

    private fun handleLocalAlertLocate(commandId: String, durationMs: Long) {
        if (processedCommands.contains(commandId)) return
        processedCommands.add(commandId)

        localSocketManager?.sendAlertAck(commandId)

        // Se tela vermelha estiver ativa, dispara Activity de tela cheia ou overlay
        runOnUiThread {
            val intent = Intent(this, LocateAlertActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_SINGLE_TOP
                putExtra(LocateAlertActivity.EXTRA_DURATION_MS, durationMs)
                putExtra(LocateAlertActivity.EXTRA_ENABLE_SOUND, preferences.isSoundAlertEnabled)
                putExtra(LocateAlertActivity.EXTRA_ENABLE_VIBRATE, preferences.isVibrationAlertEnabled)
            }
            startActivity(intent)
        }
    }

    @SuppressLint("BatteryLife")
    private fun requestIgnoreBatteryOptimization() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            try {
                val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
                if (!powerManager.isIgnoringBatteryOptimizations(packageName)) {
                    val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                        data = Uri.parse("package:$packageName")
                    }
                    startActivity(intent)
                } else {
                    Toast.makeText(this, "Otimização de bateria já está desativada para este app.", Toast.LENGTH_SHORT).show()
                }
            } catch (e: Exception) {
                // Alternativa caso ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS não seja permitida pelo fabricante
                val intent = Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)
                startActivity(intent)
            }
        } else {
            Toast.makeText(this, "Não é necessário em versões anteriores do Android.", Toast.LENGTH_SHORT).show()
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        stopLocalSocket()
        alertJob?.cancel()
    }
}
