package dev.mote.collector

import android.content.Context
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.TimeUnit
import java.util.concurrent.locks.ReentrantReadWriteLock

/** Serializes explicit connection changes against current upload/scan and capture work. */
object ConnectionGuard {
    private val lock = ReentrantReadWriteLock()
    private val updating = AtomicBoolean(false)
    private val localBinding = ThreadLocal.withInitial { false }
    internal fun permitsLocalBinding() = localBinding.get()
    val processing = AtomicInteger(0)
    fun changing() = lock.isWriteLocked || updating.get()
    fun reconfiguring() = updating.get()
    fun ownsConfiguration() = lock.isWriteLockedByCurrentThread
    fun beginReconfiguration() = updating.compareAndSet(false, true)
    fun endReconfiguration() { updating.set(false) }
    fun configurationStamp(context: Context) = Settings(context).read().captureStamp()
    fun startCapture(context: Context, expectedStamp: String, start: () -> Unit): Boolean = sync {
        val settings = Settings(context)
        if (settings.enabled || expectedStamp != configurationStamp(context)) return@sync false
        settings.enabled = true
        try { start(); true } catch (e: Exception) { settings.enabled = false; throw e }
    } ?: false
    fun <T> sync(action: () -> T): T? {
        if (updating.get()) return null
        if (!lock.readLock().tryLock()) return null
        return try { if (updating.get()) null else action() } finally { lock.readLock().unlock() }
    }
    fun <T> reconfigure(context: Context, nextServer: String, bindLocal: Boolean = false, expected: CollectorConfig? = null, action: () -> T): T {
        check(updating.get())
        if (!lock.writeLock().tryLock(120, TimeUnit.SECONDS)) throw ConnectionFailure("busy")
        try {
            check(processing.get() == 0) { MoteI18n.text("采集处理尚未结束") }
            if (expected != null && Settings(context).read() != expected) throw SettingsChangedFailure()
            validateOrigin(context, nextServer, bindLocal)
            localBinding.set(bindLocal)
            try { return action() } finally { localBinding.set(false) }
        } finally { lock.writeLock().unlock() }
    }
    private fun validateOrigin(context: Context, nextServer: String, bindLocal: Boolean) {
        val settings = Settings(context)
        if (settings.dataOrigin().isBlank() && nextServer.isNotBlank() && settings.hasPendingData() && !bindLocal) throw ConnectionFailure("local_confirmation")
    }
    fun <T> change(context: Context, nextServer: String, bindLocal: Boolean = false, action: () -> T): T {
        if (updating.get() && lock.isWriteLockedByCurrentThread) { validateOrigin(context, nextServer, bindLocal || permitsLocalBinding()); return action() }
        if (updating.get()) throw ConnectionFailure("busy")
        if (!lock.writeLock().tryLock()) throw ConnectionFailure("busy")
        try {
            val settings = Settings(context)
            if (settings.enabled || ProjectionService.running || processing.get() > 0) throw ConnectionFailure("busy")
            validateOrigin(context, nextServer, bindLocal)
            localBinding.set(bindLocal)
            try { return action() } finally { localBinding.set(false) }
        } finally { lock.writeLock().unlock() }
    }
}
