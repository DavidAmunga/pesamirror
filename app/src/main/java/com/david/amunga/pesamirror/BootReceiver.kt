package com.david.amunga.pesamirror

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build

/**
 * Restarts the SMS trigger foreground service after boot if the user had it enabled.
 */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED) return
        val prefs = SecurePrefs.get(context)
        if (!prefs.getBoolean(MainActivity.KEY_SMS_TRIGGER_ENABLED, false)) return
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(Intent(context, SmsTriggerService::class.java))
        } else {
            context.startService(Intent(context, SmsTriggerService::class.java))
        }
    }
}
