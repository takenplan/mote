package dev.mote.collector
import org.junit.Assert.*
import org.junit.Test
class AppearancePreferenceTest {
    @Test fun invalidOrNewPreferenceFollowsSystem() {
        for (value in listOf(null, "", "system", "broken")) assertEquals(AppearancePreference.AUTO, AppearancePreference.parse(value))
    }
    @Test fun manualChoiceSurvivesSystemChangesAndAutoResolvesImmediately() {
        for (systemDark in listOf(false, true)) {
            assertFalse(AppearancePreference.LIGHT.dark(systemDark)); assertTrue(AppearancePreference.DARK.dark(systemDark))
            assertEquals(systemDark, AppearancePreference.AUTO.dark(systemDark))
        }
        assertEquals("auto", AppearancePreference.AUTO.value)
    }
}
