package dev.mote.collector

import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File

class StorageDirectoryTest {
    @get:Rule val folder = TemporaryFolder()

    @Test fun createsMissingDirectoryAndAcceptsAnExistingDirectory() {
        val directory = File(folder.root, "generated/pending")
        assertSame(directory, requireStorageDirectory(directory))
        assertTrue(directory.isDirectory)
        assertSame(directory, requireStorageDirectory(directory))
    }

    @Test fun anotherStartupReaderCanCreateTheDirectoryBeforeMkdirsReturns() {
        val directory = object : File(folder.root, "generated-raced-directory") {
            override fun mkdirs(): Boolean {
                // Model the observed Application recovery / connection-save interleaving.
                assertTrue(File(absolutePath).mkdirs())
                return false
            }
        }
        assertFalse(directory.exists())
        assertSame(directory, requireStorageDirectory(directory))
        assertTrue(directory.isDirectory)
    }

    @Test fun aRegularFileStillCannotBecomeTheStorageDirectory() {
        val file = folder.newFile("generated-blocking-file")
        assertThrows(IllegalStateException::class.java) { requireStorageDirectory(file) }
        assertTrue(file.isFile)
    }
}
