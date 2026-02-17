package com.david.amunga.pesamirror

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat

/**
 * Foreground service to keep the app process running so SMS triggers can be received
 * and USSD automation can run. Started when user enables "SMS trigger" in settings.
 */
class SmsTriggerService : Service() {

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        val channelId = "pesamirror_sms_trigger"
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                channelId,
                getString(R.string.sms_trigger_channel_name),
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                setShowBadge(false)
                description = getString(R.string.sms_trigger_notification_text)
                setSound(null, null)
                enableVibration(false)
            }
            (getSystemService(NOTIFICATION_SERVICE) as NotificationManager).createNotificationChannel(channel)
        }
        val openApp = PendingIntent.getActivity(
            this, 0, Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val color = getColor(R.color.primary_green)
        val notification = NotificationCompat.Builder(this, channelId)
            .setContentTitle(getString(R.string.sms_trigger_notification_title))
            .setContentText(getString(R.string.sms_trigger_notification_text))
            .setSmallIcon(R.drawable.ic_notification)
            .setContentIntent(openApp)
            .setOngoing(true)
            .setColor(color)
            .setColorized(true)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setStyle(NotificationCompat.BigTextStyle().bigText(getString(R.string.sms_trigger_notification_text)))
            .build()
        startForeground(NOTIFICATION_ID, notification)
    }
}

const val NOTIFICATION_ID = 9001
