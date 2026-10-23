package com.phonefinder.data

import android.util.Log
import io.socket.client.IO
import io.socket.client.Socket
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import okhttp3.OkHttpClient
import org.json.JSONObject
import java.net.URI
import java.util.concurrent.TimeUnit

class SocketManager(private val preferences: DevicePreferences) {

    private var socket: Socket? = null
    private var currentConnectedUrl: String? = null
    private val managerScope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private var reconnectJob: Job? = null

    private val okHttpClient: OkHttpClient = OkHttpClient.Builder()
        .pingInterval(20, TimeUnit.SECONDS)
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(0, TimeUnit.MILLISECONDS)
        .writeTimeout(15, TimeUnit.SECONDS)
        .retryOnConnectionFailure(true)
        .build()

    var onConnectionChanged: ((Boolean) -> Unit)? = null
    var onPairingResult: ((Boolean, String?, String?, String?) -> Unit)? = null
    var onAlertLocate: ((commandId: String, durationMs: Long) -> Unit)? = null
    var onDeviceUnpaired: (() -> Unit)? = null

    fun connect(serverUrl: String = preferences.serverUrl) {
        val normalizedUrl = normalizeUrl(serverUrl)
        disconnect()

        try {
            currentConnectedUrl = normalizedUrl
            val uri = URI.create(normalizedUrl)
            val options = IO.Options().apply {
                callFactory = okHttpClient
                webSocketFactory = okHttpClient
                forceNew = true
                reconnection = true
                reconnectionAttempts = Int.MAX_VALUE
                reconnectionDelay = 2000
                reconnectionDelayMax = 10000
                timeout = 20000
                // Habilitar websocket com fallback de polling para compatibilidade total de rede
                transports = arrayOf("websocket", "polling")
            }

            Log.d(TAG, "Iniciando conexão Socket.IO para $normalizedUrl")
            socket = IO.socket(uri, options).apply {
                on(Socket.EVENT_CONNECT) {
                    Log.i(TAG, "Socket conectado com sucesso (ID: ${id()}) em $normalizedUrl")
                    cancelReconnect()
                    onConnectionChanged?.invoke(true)
                    // Se já tiver deviceId salvo, identifica-se na reconexão
                    preferences.deviceId?.let { id ->
                        Log.d(TAG, "Identificando dispositivo: $id")
                        identifyDevice(id)
                    }
                }

                on(Socket.EVENT_DISCONNECT) { args ->
                    val reason = if (args.isNotEmpty()) args[0].toString() else "unknown"
                    Log.w(TAG, "Socket desconectado. Motivo: $reason")
                    onConnectionChanged?.invoke(false)
                    if (preferences.deviceId != null) {
                        scheduleReconnect()
                    }
                }

                on(Socket.EVENT_CONNECT_ERROR) { args ->
                    val err = if (args.isNotEmpty()) args[0].toString() else "unknown"
                    Log.w(TAG, "Erro de conexão no Socket ($normalizedUrl): $err")
                    onConnectionChanged?.invoke(false)
                    if (preferences.deviceId != null) {
                        scheduleReconnect()
                    }
                }

                on("pairing:result") { args ->
                    if (args.isNotEmpty() && args[0] is JSONObject) {
                        val json = args[0] as JSONObject
                        val success = json.optBoolean("success", false)
                        val deviceId = if (json.has("deviceId") && !json.isNull("deviceId")) json.getString("deviceId") else null
                        val cardName = if (json.has("cardName") && !json.isNull("cardName")) json.getString("cardName") else null
                        val error = if (json.has("error") && !json.isNull("error")) json.getString("error") else null
                        onPairingResult?.invoke(success, deviceId, cardName, error)
                    }
                }

                on("alert:locate") { args ->
                    if (args.isNotEmpty() && args[0] is JSONObject) {
                        val json = args[0] as JSONObject
                        val commandId = json.optString("commandId", "")
                        val durationMs = json.optLong("durationMs", 5000L)
                        onAlertLocate?.invoke(commandId, durationMs)
                    }
                }

                on("device:unpaired") {
                    Log.i(TAG, "Recebido evento de desvinculação do card.")
                    onDeviceUnpaired?.invoke()
                }

                connect()
            }
        } catch (e: Exception) {
            Log.e(TAG, "Falha crítica ao inicializar Socket.IO para $normalizedUrl", e)
            onConnectionChanged?.invoke(false)
        }
    }

    fun submitPairingCode(code: String) {
        val payload = JSONObject().apply {
            put("code", code)
        }
        Log.d(TAG, "Enviando código de pareamento: $code")
        socket?.emit("pairing:submit", payload)
    }

    fun identifyDevice(deviceId: String) {
        val payload = JSONObject().apply {
            put("deviceId", deviceId)
        }
        Log.d(TAG, "Identificando dispositivo: $deviceId")
        socket?.emit("device:identify", payload)
    }

    fun sendAlertAck(commandId: String, status: String = "ok") {
        val payload = JSONObject().apply {
            put("commandId", commandId)
            put("status", status)
            put("timestamp", System.currentTimeMillis())
        }
        socket?.emit("alert:ack", payload)
    }

    fun sendBatteryStatus(level: Int, isCharging: Boolean) {
        val deviceId = preferences.deviceId ?: return
        val payload = JSONObject().apply {
            put("deviceId", deviceId)
            put("level", level)
            put("isCharging", isCharging)
        }
        Log.d(TAG, "Enviando telemetria de bateria: $level% (Carregando: $isCharging)")
        socket?.emit("device:battery", payload)
    }

    fun disconnect() {
        cancelReconnect()
        socket?.disconnect()
        socket?.off()
        socket = null
        currentConnectedUrl = null
    }

    fun ensureConnected() {
        if (isConnected) {
            Log.d(TAG, "ensureConnected: socket já está conectado.")
            return
        }

        val targetUrl = normalizeUrl(preferences.serverUrl)
        if (socket != null && currentConnectedUrl == targetUrl) {
            Log.d(TAG, "ensureConnected: socket existente para $targetUrl desconectado. Chamando socket.connect()...")
            socket?.connect()
        } else {
            Log.d(TAG, "ensureConnected: URL alterada ou socket nulo. Reiniciando conexão para $targetUrl...")
            connect(targetUrl)
        }
    }

    fun scheduleReconnect() {
        if (reconnectJob?.isActive == true || isConnected) return

        reconnectJob = managerScope.launch {
            var attempt = 1
            while (!isConnected && preferences.deviceId != null && isActive) {
                val delayTime = (attempt * 2000L).coerceAtMost(20000L)
                Log.d(TAG, "Reconexão proativa #$attempt agendada para daqui a ${delayTime}ms...")
                delay(delayTime)
                if (isConnected) break
                try {
                    ensureConnected()
                } catch (e: Exception) {
                    Log.e(TAG, "Falha na tentativa de reconexão proativa #$attempt", e)
                }
                attempt++
            }
        }
    }

    private fun cancelReconnect() {
        reconnectJob?.cancel()
        reconnectJob = null
    }

    val isConnected: Boolean
        get() = socket?.connected() == true

    companion object {
        private const val TAG = "SocketManager"

        /**
         * Normaliza a URL do servidor:
         * - Adiciona http:// se não fornecido
         * - Redireciona porta 3000 (Vite) para 3001 (Socket.IO)
         * - Adiciona porta :3001 se nenhuma porta for fornecida
         * - Remove barras finais
         */
        fun normalizeUrl(raw: String): String {
            var url = raw.trim()
            if (url.isEmpty()) return ""

            if (!url.startsWith("http://", ignoreCase = true) && !url.startsWith("https://", ignoreCase = true)) {
                url = "http://$url"
            }

            // Remove trailing slashes
            url = url.trimEnd('/')

            val uri = try {
                URI.create(url)
            } catch (_: Exception) {
                return url
            }

            val host = uri.host ?: url.substringAfter("://").substringBefore(':').substringBefore('/')
            var port = uri.port

            // Se o usuário digitou a porta 3000 do receptor web, converte para a porta 3001 do backend Socket.IO
            if (port == 3000 || port == -1) {
                port = 3001
            }

            val scheme = uri.scheme ?: "http"
            return "$scheme://$host:$port"
        }
    }
}
