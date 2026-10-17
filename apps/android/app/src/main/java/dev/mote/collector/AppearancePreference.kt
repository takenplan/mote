package dev.mote.collector

/** Persist the selection, never today's resolved system color. */
internal enum class AppearancePreference(val value: String) {
    LIGHT("light"), DARK("dark"), AUTO("auto");
    fun dark(systemDark: Boolean) = when (this) { LIGHT -> false; DARK -> true; AUTO -> systemDark }
    companion object { fun parse(value: String?) = entries.firstOrNull { it.value == value } ?: AUTO }
}
