package dev.mote.collector

/** A home block that reads existing data while the home is visible. Each block owns its identity checks and empty state. */
internal interface HomeSection {
    fun refresh()
    fun pause()
    fun close()
}
