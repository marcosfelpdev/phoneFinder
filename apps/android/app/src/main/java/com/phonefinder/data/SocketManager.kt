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
        disconnect()

        try {
            val uri = URI.create(serverUrl)
            val options = IO.Options().apply {
                callFactory = okHttpClient
                webSocketFactory = okHttpClient
                forceNew = true
                reconnection = true
                reconnectionAttempts = Int.MAX_VALUE
                reconnectionDelay = 2000
                reconnectionDelayMax = 10000
                timeout = 20000
                transports = arrayOf("websocket")
            }

            Log.d(TAG, "Iniciando conexão Socket.IO para $serverUrl")
            socket = IO.socket(uri, options).apply {
                on(Socket.EVENT_CONNECT) {
                    Log.i(TAG, "Socket conectado com sucesso (ID: ${id()})")
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
                    Log.w(TAG, "Erro de conexão no Socket: $err")
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
                        if (commandId.isNotEmpty()) {
                            onAlertLocate?.invoke(commandId, durationMs)
                        }
                    }
                }

                on("device:unpaired") {
                    onDeviceUnpaired?.invoke()
                }

                connect()
            }
        } catch (e: Exception) {
            e.printStackTrace()
            onConnectionChanged?.invoke(false)
        }
    }

    fun submitPairingCode(code: String) {
        val payload = JSONObject().apply {
            put("code", code)
        }
        socket?.emit("pairing:submit", payload)
    }

    fun identifyDevice(deviceId: String) {
        val payload = JSONObject().apply {
            put("deviceId", deviceId)
        }
        socket?.emit("device:identify", payload)
    }

    fun sendAlertAck(commandId: String) {
        val ack = JSONObject().apply {
            put("commandId", commandId)
            put("status", "ok")
            put("timestamp", System.currentTimeMillis())
        }
        socket?.emit("alert:ack", ack)
    }

    fun disconnect() {
        cancelReconnect()
        socket?.disconnect()
        socket?.off()
        socket = null
    }

    fun ensureConnected() {
        if (isConnected) {
            Log.d(TAG, "ensureConnected: socket já está conectado.")
            return
        }

        if (socket != null) {
            Log.d(TAG, "ensureConnected: socket desconectado. Chamando socket.connect()...")
            socket?.connect()
        } else {
            Log.d(TAG, "ensureConnected: socket nulo. Inicializando nova conexão...")
            connect(preferences.serverUrl)
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
    }
}
