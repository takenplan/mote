package dev.mote.collector

import java.io.File

/** A competing startup reader may create the same directory before mkdirs returns. */
internal fun requireStorageDirectory(directory: File): File = directory.apply {
    check(isDirectory || mkdirs() || isDirectory) { "Cannot create local storage directory" }
}
