package com.david.amunga.pesamirror

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKeys
import java.io.File

/**
 * Provides encrypted SharedPreferences for USSD/prefs data (including M-PESA PIN).
 * Uses Android Keystore (AES-256-GCM): keys are hardware-backed where available
 * and are isolated to this app — no other app can access them.
 */
object SecurePrefs {

    /** Same logical name as MainActivity.PREFS_NAME; encrypted storage uses a different file. */
    private const val ENCRYPTED_PREFS_FILE = "ussd_prefs_encrypted"
    private const val LEGACY_PREFS_FILE = "ussd_prefs"

    @Volatile
    private var instance: SharedPreferences? = null

    fun get(context: Context): SharedPreferences {
        return instance ?: synchronized(this) {
            instance ?: createEncryptedPrefs(context).also {
                instance = it
                migrateFromLegacyIfNeeded(context, it)
            }
        }
    }

    private fun createEncryptedPrefs(context: Context): SharedPreferences {
        val masterKey = MasterKeys.getOrCreate(MasterKeys.AES256_GCM_SPEC)
        return EncryptedSharedPreferences.create(
            ENCRYPTED_PREFS_FILE,
            masterKey,
            context,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
    }

    /**
     * One-time migration: copy from legacy plain prefs into encrypted prefs, then clear legacy.
     * Keeps existing users' PIN and settings after the security update.
     */
    private fun migrateFromLegacyIfNeeded(context: Context, encrypted: SharedPreferences) {
        val legacyFile = File(context.applicationInfo.dataDir + "/shared_prefs", "$LEGACY_PREFS_FILE.xml")
        if (!legacyFile.exists()) return
        val legacy = context.getSharedPreferences(LEGACY_PREFS_FILE, Context.MODE_PRIVATE)
        if (legacy.all.isEmpty()) return
        val editor = encrypted.edit()
        for ((key, value) in legacy.all) {
            when (value) {
                is String -> editor.putString(key, value)
                is Boolean -> editor.putBoolean(key, value)
                is Int -> editor.putInt(key, value)
                is Long -> editor.putLong(key, value)
                is Float -> editor.putFloat(key, value)
                is Set<*> -> @Suppress("UNCHECKED_CAST") editor.putStringSet(key, value as? Set<String>)
            }
        }
        editor.apply()
        legacy.edit().clear().apply()
    }
}
