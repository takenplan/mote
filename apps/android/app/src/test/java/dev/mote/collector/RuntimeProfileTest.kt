package dev.mote.collector

import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File

class RuntimeProfileTest {
    @get:Rule val folder = TemporaryFolder()

    @Test fun onlyDevUsesPrivateFileCredentials() {
        assertTrue(RuntimeProfile.DEV.fileCredentials)
        assertFalse(RuntimeProfile.PROD.fileCredentials)
        assertFalse(RuntimeProfile.TEST.fileCredentials)
        assertEquals(RuntimeProfile.PROD, RuntimeProfile.parse("default"))
        assertThrows(IllegalStateException::class.java) { RuntimeProfile.parse("unknown") }
    }

    @Test fun devCredentialAndPrivateJsonSurviveRecreationWithoutOpeningKeystore() {
        val directory = folder.newFolder()
        DevCredentialFormat.requireCurrent(directory, hasConfiguration = false)
        val keyFile = DevCredentialFormat.keyFile(directory)
        val key = keyFile.readBytes()
        fun box() = SecretBox(RuntimeProfile.DEV, keyFile) { error("Dev must never open Android Keystore") }
        val token = "generated-dev-token-01234567890123456789"
        val stored = CredentialValue(RuntimeProfile.DEV, box()).encode(token)
        assertEquals(token, JSONObject(stored).getString("token"))
        assertEquals(token, CredentialValue(RuntimeProfile.DEV, box()).decode(stored))
        CentralStateFile(directory, "generated", box()).write(JSONObject().put("note", "generated private draft"))
        assertFalse(File(directory, "generated.enc").readText().contains("generated private draft"))
        assertEquals("generated private draft", CentralStateFile(directory, "generated", box()).read().getString("note"))
        assertArrayEquals(key, keyFile.readBytes())
        val tampered = File(directory, "generated.enc").readBytes().also { it[it.lastIndex] = (it.last().toInt() xor 1).toByte() }
        assertThrows(javax.crypto.AEADBadTagException::class.java) { box().open(tampered) }
    }

    @Test fun missingOrCorruptDevKeysNeverRegenerateOrRewritePrivateCiphertext() {
        val directory = folder.newFolder()
        DevCredentialFormat.requireCurrent(directory, hasConfiguration = false)
        val keyFile = DevCredentialFormat.keyFile(directory)
        fun box() = SecretBox(RuntimeProfile.DEV, keyFile) { error("Dev must never open Android Keystore") }
        CentralStateFile(directory, "generated", box()).write(JSONObject().put("note", "generated private draft"))
        val stored = File(directory, "generated.enc").readBytes()
        val originalKey = keyFile.readBytes()
        assertTrue(keyFile.delete())
        assertThrows(IllegalStateException::class.java) { DevCredentialFormat.requireCurrent(directory, hasConfiguration = true) }
        assertThrows(IllegalStateException::class.java) { box().open(stored) }
        assertFalse(keyFile.exists())
        keyFile.writeText("{broken-key")
        java.nio.file.Files.setPosixFilePermissions(keyFile.toPath(), setOf(java.nio.file.attribute.PosixFilePermission.OWNER_READ, java.nio.file.attribute.PosixFilePermission.OWNER_WRITE))
        assertThrows(Exception::class.java) { DevCredentialFormat.requireCurrent(directory, hasConfiguration = true) }
        assertThrows(Exception::class.java) { box().open(stored) }
        assertEquals("{broken-key", keyFile.readText())
        assertArrayEquals(stored, File(directory, "generated.enc").readBytes())
        keyFile.writeBytes(originalKey)
        assertEquals("generated private draft", CentralStateFile(directory, "generated", box()).read().getString("note"))
    }

    @Test fun interruptedCurrentKeyInitializationResumesOnlyWithoutConfigurationOrPrivateContent() {
        val directory = folder.newFolder()
        LocalDataFormat.requireCurrent(directory)
        val keyFile = DevCredentialFormat.keyFile(directory)
        DevSecretKeyFile(keyFile).initialize()
        val original = keyFile.readBytes()
        DevCredentialFormat.requireCurrent(directory, hasConfiguration = false)
        DevCredentialFormat.requireCurrent(directory, hasConfiguration = true)
        assertArrayEquals(original, keyFile.readBytes())

        val privateDirectory = folder.newFolder()
        LocalDataFormat.requireCurrent(privateDirectory)
        val privateKeyFile = DevCredentialFormat.keyFile(privateDirectory)
        DevSecretKeyFile(privateKeyFile).initialize()
        val privateContent = File(privateDirectory, "existing.enc").apply { writeBytes(byteArrayOf(1, 2, 3)) }
        assertThrows(IllegalStateException::class.java) { DevCredentialFormat.requireCurrent(privateDirectory, hasConfiguration = false) }
        assertArrayEquals(byteArrayOf(1, 2, 3), privateContent.readBytes())
    }

    @Test fun prodAndTestCredentialsRequireTheirProtectedCipher() {
        for (profile in listOf(RuntimeProfile.PROD, RuntimeProfile.TEST)) {
            val box = SecretBox(profile) { error("Protected storage unavailable") }
            assertThrows(IllegalStateException::class.java) { CredentialValue(profile, box).encode("generated-token") }
            assertThrows(IllegalStateException::class.java) { box.open("generated".toByteArray()) }
        }
    }

    @Test fun prodKeepsTheProtectedCredentialRoundTripAndLazyProvider() {
        var constructed = 0
        val box = SecretBox(RuntimeProfile.PROD, protectedCipher = {
            constructed++
            object : ByteCipher {
                override fun seal(bytes: ByteArray) = bytes.map { (it.toInt() xor 90).toByte() }.toByteArray()
                override fun open(bytes: ByteArray) = seal(bytes)
            }
        })
        val credentials = CredentialValue(RuntimeProfile.PROD, box)
        assertEquals(0, constructed)
        val token = "generated-production-owner-credential"
        val stored = credentials.encode(token)
        assertFalse(stored.contains(token))
        assertEquals(token, credentials.decode(stored))
        assertEquals(1, constructed)
    }

    @Test fun devRefusesRetiredEncryptedSettingsWithoutMutatingThem() {
        val directory = folder.newFolder()
        val old = File(directory, "retired.enc").apply { writeBytes(byteArrayOf(3, 7, 11)) }
        assertThrows(IllegalStateException::class.java) { DevCredentialFormat.requireCurrent(directory, hasConfiguration = true) }
        assertArrayEquals(byteArrayOf(3, 7, 11), old.readBytes())
        assertEquals(listOf("retired.enc"), directory.list()!!.toList())
        val fresh = folder.newFolder()
        DevCredentialFormat.requireCurrent(fresh, hasConfiguration = false)
        DevCredentialFormat.requireCurrent(fresh, hasConfiguration = true)
    }

}
