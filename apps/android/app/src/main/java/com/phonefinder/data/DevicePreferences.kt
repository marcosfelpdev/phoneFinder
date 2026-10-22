package com.phonefinder.data

import android.content.Context
import android.content.SharedPreferences

class DevicePreferences(context: Context) {
    private val prefs: SharedPreferences =
        context.getSharedPreferences("phone_finder_prefs", Context.MODE_PRIVATE)

    companion object {
        private const val KEY_SERVER_URL = "server_url"
        private const val KEY_DEVICE_ID = "device_id"
        private const val KEY_CARD_NAME = "card_name"
        private const val KEY_OPT_SCREEN_RED = "opt_screen_red"
        private const val KEY_OPT_SOUND = "opt_sound"
        private const val KEY_OPT_VIBRATE = "opt_vibrate"
        private const val KEY_OPT_SERVICE = "opt_foreground_service"
        const val DEFAULT_SERVER_URL = "http://192.168.1.4:3001"
    }

    var serverUrl: String
        get() = prefs.getString(KEY_SERVER_URL, DEFAULT_SERVER_URL) ?: DEFAULT_SERVER_URL
        set(value) = prefs.edit().putString(KEY_SERVER_URL, value.trim()).apply()

    var deviceId: String?
        get() = prefs.getString(KEY_DEVICE_ID, null)
        set(value) = prefs.edit().putString(KEY_DEVICE_ID, value).apply()

    var cardName: String?
        get() = prefs.getString(KEY_CARD_NAME, null)
        set(value) = prefs.edit().putString(KEY_CARD_NAME, value).apply()

    var isScreenRedEnabled: Boolean
        get() = prefs.getBoolean(KEY_OPT_SCREEN_RED, true)
        set(value) = prefs.edit().putBoolean(KEY_OPT_SCREEN_RED, value).apply()

    var isSoundAlertEnabled: Boolean
        get() = prefs.getBoolean(KEY_OPT_SOUND, true)
        set(value) = prefs.edit().putBoolean(KEY_OPT_SOUND, value).apply()

    var isVibrationAlertEnabled: Boolean
        get() = prefs.getBoolean(KEY_OPT_VIBRATE, true)
        set(value) = prefs.edit().putBoolean(KEY_OPT_VIBRATE, value).apply()

    var isForegroundServiceEnabled: Boolean
        get() = prefs.getBoolean(KEY_OPT_SERVICE, true)
        set(value) = prefs.edit().putBoolean(KEY_OPT_SERVICE, value).apply()

    fun clearDevice() {
        prefs.edit()
            .remove(KEY_DEVICE_ID)
            .remove(KEY_CARD_NAME)
            .apply()
    }
}
