package dev.mote.collector

import android.Manifest
import android.content.ContentProvider
import android.content.ContentResolver
import android.content.ContentUris
import android.content.ContentValues
import android.content.Context
import android.content.ContextWrapper
import android.content.pm.PackageManager
import android.content.pm.ProviderInfo
import android.database.Cursor
import android.database.MatrixCursor
import android.net.Uri
import android.provider.CalendarContract
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

/** External native I/O substitute only. Never registered with Android's provider
 * registry, never requests a permission and never touches the system calendar. */
internal class GeneratedCalendarContext(base: Context, private val calendar: GeneratedCalendarProvider) : ContextWrapper(base) {
    var allowed = true
    @Volatile var beforePermission: (() -> Unit)? = null
    private val generatedResolver = ContentResolver.wrap(calendar.apply {
        attachInfo(base, ProviderInfo().apply { authority = CalendarContract.AUTHORITY; exported = false })
    })
    override fun getApplicationContext(): Context = this
    override fun getContentResolver(): ContentResolver = generatedResolver
    override fun checkSelfPermission(permission: String): Int =
        if (permission in setOf(Manifest.permission.READ_CALENDAR, Manifest.permission.WRITE_CALENDAR)) {
            beforePermission?.let { beforePermission = null; it() }
            if (allowed) PackageManager.PERMISSION_GRANTED else PackageManager.PERMISSION_DENIED
        } else super.checkSelfPermission(permission)
}

internal class GeneratedCalendarProvider(private val state: File) : ContentProvider() {
    var failAfterNextInsert = false
    var calls = 0
        private set
    private var rows = if (state.isFile) JSONObject(state.readText()).getJSONArray("events") else JSONArray()
    var inserts = if (state.isFile) JSONObject(state.readText()).getInt("inserts") else 0
        private set
    override fun onCreate() = true
    override fun getType(uri: Uri) = "vnd.android.cursor.item/event"
    private fun persist() { state.writeText(JSONObject().put("inserts", inserts).put("events", rows).toString()) }
    override fun query(uri: Uri, projection: Array<out String>?, selection: String?, selectionArgs: Array<out String>?, sortOrder: String?): Cursor {
        calls++
        check(uri.authority == CalendarContract.AUTHORITY)
        val columns = requireNotNull(projection)
        val result = MatrixCursor(columns)
        when (uri.pathSegments.firstOrNull()) {
            "calendars" -> result.addRow(columns.map { if (it == "_id") "7" else "Generated writable calendar" })
            "events" -> {
                val id = uri.lastPathSegment?.toLongOrNull()?.toString()
                val values = (0 until rows.length()).map(rows::getJSONObject).filter { row ->
                    if (id != null) row.getString("_id") == id
                    else row.getString("calendar_id") == selectionArgs!![0] && row.getString("description").contains(selectionArgs[1].trim('%'))
                }
                values.forEach { row -> result.addRow(columns.map { row.optString(it, "") }) }
            }
            "attendees" -> Unit
            else -> error("Unexpected generated calendar read")
        }
        return result
    }
    override fun insert(uri: Uri, values: ContentValues?): Uri {
        calls++; check(uri.pathSegments == listOf("events"))
        val event = JSONObject(); requireNotNull(values).keySet().forEach { event.put(it, values.getAsString(it)) }
        inserts++; val id = (100 + inserts).toLong(); event.put("_id", id.toString()); rows.put(event); persist()
        if (failAfterNextInsert) { failAfterNextInsert = false; error("Generated native response lost after durable insert") }
        return ContentUris.withAppendedId(uri, id)
    }
    override fun update(uri: Uri, values: ContentValues?, selection: String?, selectionArgs: Array<out String>?): Int = error("No update in this generated creation journey")
    override fun delete(uri: Uri, selection: String?, selectionArgs: Array<out String>?): Int = error("No deletion in this generated creation journey")
}
