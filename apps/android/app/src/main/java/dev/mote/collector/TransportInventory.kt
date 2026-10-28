package dev.mote.collector

/** Queue-owned pending facts, kept separate from dispatch policy and UI classification. */
internal data class TransportInventory(
    val captures: PendingSync,
    val sources: PendingSync,
    val files: PendingSync,
) {
    val pending: PendingSync get() = PendingSync(
        captures.count + sources.count + files.count,
        listOfNotNull(captures.oldestAt, sources.oldestAt, files.oldestAt).minOrNull(),
        sources.pendingUpdates,
    )
}
