package dev.mote.collector

/** Select Mote credential storage before constructing a platform secret provider. */
enum class RuntimeProfile(val wire: String) {
    DEV("dev"), PROD("prod"), TEST("test");

    val fileCredentials get() = this == DEV

    companion object {
        val current get() = parse(BuildConfig.MOTE_PROFILE)
        fun parse(value: String): RuntimeProfile = if (value == "default") PROD else entries.singleOrNull { it.wire == value }
            ?: error("Unsupported Mote profile")
    }
}
