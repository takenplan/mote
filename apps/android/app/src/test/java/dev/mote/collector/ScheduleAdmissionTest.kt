package dev.mote.collector

import org.junit.Assert.*
import org.junit.Test
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference

class ScheduleAdmissionTest {
    @Test fun aDisconnectedStartupRequestArrivingAfterPairingCannotCancelTheNewTask() {
        val disconnected = CollectorConfig(deviceName = "Generated fixture", server = "", token = "")
        val connected = disconnected.copy(server = "http://127.0.0.1:47843", token = "generated-android-node-token-1234567890")
        val current = AtomicReference(disconnected)
        val oldReady = CountDownLatch(1); val releaseOld = CountDownLatch(1)
        val monitor = Any(); val tasks = mutableSetOf<String>(); var status = "unconfigured"
        val rejected = AtomicReference<Boolean?>(null)
        val old = Thread {
            oldReady.countDown(); check(releaseOld.await(5, TimeUnit.SECONDS))
            synchronized(monitor) {
                val accepted = ScheduleAdmission.isCurrent(disconnected, current.get())
                rejected.set(!accepted)
                if (accepted) { status = "unconfigured"; tasks.clear() }
            }
        }
        old.start()
        try {
            assertTrue(oldReady.await(5, TimeUnit.SECONDS))
            synchronized(monitor) {
                current.set(connected)
                assertTrue(ScheduleAdmission.isCurrent(connected, current.get()))
                status = "waiting"; tasks.add("new-upload")
            }
            releaseOld.countDown(); old.join(5000); assertFalse(old.isAlive)
            assertEquals(true, rejected.get())
            assertEquals("waiting", status)
            assertEquals(setOf("new-upload"), tasks)
        } finally { releaseOld.countDown(); old.join(5000) }
    }

    @Test fun aLatePausedRequestCannotReplaceAResumedConfiguration() {
        val resumed = CollectorConfig(deviceName = "Generated fixture", server = "https://central.example", token = "generated-android-node-token-1234567890")
        val paused = resumed.copy(syncPaused = true)
        var called = false
        if (ScheduleAdmission.isCurrent(paused, resumed)) called = true
        assertFalse(called)
    }
}
