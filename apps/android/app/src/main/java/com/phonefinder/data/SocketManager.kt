package com.phonefinder.data

import io.socket.client.IO
import io.socket.client.Socket
import org.json.JSONObject
import java.net.URI

class SocketManager(private val preferences: DevicePreferences) {

    private var socket: Socket? = null

    var onConnectionChanged: ((Boolean) -> Unit)? = null
    var onPairingResult: ((Boolean, String?, String?, String?) -> Unit)? = null
    var onAlertLocate: ((commandId: String, durationMs: Long) -> Unit)? = null
    var onDeviceUnpaired: (() -> Unit)? = null

    fun connect(serverUrl: String = preferences.serverUrl) {
        disconnect()

        try {
            val uri = URI.create(serverUrl)
            val options = IO.Options().apply {
                reconnection = true
                reconnectionAttempts = Int.MAX_VALUE
                reconnectionDelay = 1000
                timeout = 10000
                transports = arrayOf("websocket", "polling")
            }

            socket = IO.socket(uri, options).apply {
                on(Socket.EVENT_CONNECT) {
                    onConnectionChanged?.invoke(true)
                    // Se já tiver deviceId salvo, identifica-se na reconexão
                    preferences.deviceId?.let { id ->
                        identifyDevice(id)
                    }
                }

                on(Socket.EVENT_DISCONNECT) {
                    onConnectionChanged?.invoke(false)
                }

                on(Socket.EVENT_CONNECT_ERROR) {
                    onConnectionChanged?.invoke(false)
                }

                on("pairing:result") { args ->
                    if (args.isNotEmpty() && args[0] is JSONObject) {
                        val json = args[0] as JSONObject
                        val success = json.optBoolean("success", false)
                        val deviceId = json.optString("deviceId", null)
                        val cardName = json.optString("cardName", null)
                        val error = json.optString("error", null)
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
        socket?.disconnect()
        socket?.off()
        socket = null
    }

    val isConnected: Boolean
        get() = socket?.connected() == true
}
