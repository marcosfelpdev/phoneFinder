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
import com.phonefinder.util.AlertPermissions
import com.phonefinder.util.LocateAlertController
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

        binding.btnAlertPermissions.setOnClickListener {
            requestNextAlertPermission()
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
            if (preferences.isForegroundServiceEnabled) {
                PhoneFinderForegroundService.identifyDevice(deviceId)
            }
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

        // Som + vibração + tela acesa (independente da Activity vermelha)
        LocateAlertController.start(
            context = this,
            durationMs = durationMs,
            enableSound = preferences.isSoundAlertEnabled,
            enableVibrate = preferences.isVibrationAlertEnabled,
            enableRedOverlay = false
        )

        // App em primeiro plano: pode abrir a tela vermelha diretamente
        if (preferences.isScreenRedEnabled) {
            runOnUiThread {
                val intent = Intent(this, LocateAlertActivity::class.java).apply {
                    flags = Intent.FLAG_ACTIVITY_SINGLE_TOP
                    putExtra(LocateAlertActivity.EXTRA_DURATION_MS, durationMs)
                }
                startActivity(intent)
            }
        }
    }

    override fun onResume() {
        super.onResume()
        updateAlertPermissionStatus()
        val connected = if (preferences.isForegroundServiceEnabled) {
            PhoneFinderForegroundService.isConnected
        } else {
            localSocketManager?.isConnected == true
        }
        updateConnectionUI(connected)
    }

    private fun updateAlertPermissionStatus() {
        val overlayOk = AlertPermissions.canDrawOverlays(this)
        val fsiOk = AlertPermissions.canUseFullScreenIntent(this)

        val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
        val batteryIgnored = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            powerManager.isIgnoringBatteryOptimizations(packageName)
        } else {
            true
        }

        val lines = mutableListOf(
            (if (overlayOk) "✓" else "✗") + " Sobrepor a outros apps (vermelho com a tela ligada)",
            (if (fsiOk) "✓" else "✗") + " Notificações em tela cheia (vermelho na tela de bloqueio)",
            (if (batteryIgnored) "✓" else "⚠️") + (if (batteryIgnored) " Bateria sem restrições (conexão persistente liberada)" else " Bateria com restrições (pode desconectar em repouso)")
        )
        if (AlertPermissions.isXiaomiFamily) {
            lines += "• Xiaomi/HyperOS: configure Economia de Bateria para \"Nenhuma restrição\""
        }
        binding.txtAlertPermissionStatus.text = lines.joinToString("\n")

        if (batteryIgnored) {
            binding.btnBatteryOptimization.text = "✓ Bateria Liberada em 2º Plano"
            binding.btnBatteryOptimization.isEnabled = false
        } else {
            binding.btnBatteryOptimization.text = "⚠️ Liberar Bateria para Manter Conectado"
            binding.btnBatteryOptimization.isEnabled = true
        }
    }

    /**
     * Abre, em sequência, a tela de configuração da próxima permissão especial pendente.
     * Essas permissões não podem ser solicitadas via diálogo; o usuário precisa ativá-las
     * manualmente nas Configurações do sistema.
     */
    private fun requestNextAlertPermission() {
        try {
            when {
                !AlertPermissions.canDrawOverlays(this) &&
                    Build.VERSION.SDK_INT >= Build.VERSION_CODES.M -> {
                    Toast.makeText(this, "Ative \"Sobrepor a outros apps\" para o Phone Finder.", Toast.LENGTH_LONG).show()
                    startActivity(
                        Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:$packageName"))
                    )
                }

                !AlertPermissions.canUseFullScreenIntent(this) &&
                    Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE -> {
                    Toast.makeText(this, "Ative \"Notificações em tela cheia\" para o Phone Finder.", Toast.LENGTH_LONG).show()
                    startActivity(
                        Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT, Uri.parse("package:$packageName"))
                    )
                }

                AlertPermissions.isXiaomiFamily -> openXiaomiPermissionEditor()

                else -> Toast.makeText(this, "Todas as permissões de alerta estão liberadas.", Toast.LENGTH_SHORT).show()
            }
        } catch (e: Exception) {
            openAppDetailsSettings()
        }
    }

    private fun openXiaomiPermissionEditor() {
        Toast.makeText(
            this,
            "Ative \"Exibir janelas pop-up em 2º plano\" e \"Mostrar na tela de bloqueio\".",
            Toast.LENGTH_LONG
        ).show()
        val candidates = listOf(
            Intent("miui.intent.action.APP_PERM_EDITOR").apply {
                setClassName("com.miui.securitycenter", "com.miui.permcenter.permissions.PermissionsEditorActivity")
                putExtra("extra_pkgname", packageName)
            },
            Intent("miui.intent.action.APP_PERM_EDITOR").apply {
                setClassName("com.miui.securitycenter", "com.miui.permcenter.permissions.AppPermissionsEditorActivity")
                putExtra("extra_pkgname", packageName)
            }
        )
        for (intent in candidates) {
            try {
                startActivity(intent)
                return
            } catch (_: Exception) {
                // tenta o próximo
            }
        }
        openAppDetailsSettings()
    }

    private fun openAppDetailsSettings() {
        try {
            startActivity(
                Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:$packageName"))
            )
        } catch (e: Exception) {
            Toast.makeText(this, "Abra Configurações › Apps › Phone Finder manualmente.", Toast.LENGTH_LONG).show()
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
