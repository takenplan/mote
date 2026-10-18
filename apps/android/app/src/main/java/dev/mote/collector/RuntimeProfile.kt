package dev.mote.collector

/** A build profile controls runtime defaults; a release tag never selects debug behavior. */
enum class RuntimeProfile(val wire: String) {
    DEV("dev"), PROD("prod"), TEST("test");

    val detailedDiagnostics get() = this == DEV
    val developerTools get() = this != PROD
    val fileCredentials get() = this == DEV

    companion object {
        val current get() = parse(BuildConfig.MOTE_PROFILE)
        fun parse(value: String): RuntimeProfile = entries.singleOrNull { it.wire == value }
            ?: error("Unsupported Mote profile")
    }
}
