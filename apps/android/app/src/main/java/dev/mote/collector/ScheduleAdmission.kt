package dev.mote.collector

/** Reject a request whose saved configuration has already changed before admission. */
internal object ScheduleAdmission {
    fun <T> isCurrent(expected: T, current: T): Boolean = expected == current
}
