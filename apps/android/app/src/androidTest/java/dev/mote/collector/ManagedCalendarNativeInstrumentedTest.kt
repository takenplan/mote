package dev.mote.collector

import android.content.ContentUris
import android.content.ContentValues
import android.content.Context
import android.os.Build
import android.provider.CalendarContract
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Assume.assumeTrue
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File
import java.util.UUID

/** Production HTTP, Kotlin executor and Calendar Provider on a dedicated generated emulator. */
@RunWith(AndroidJUnit4::class)
class ManagedCalendarNativeInstrumentedTest {
    @Test fun scopeBoundMutationsRetainReceiptsAndRefuseChangedNativeEvents() {
        val args=InstrumentationRegistry.getArguments()
        assumeTrue(args.getString("managedCalendarNativeFixture")=="true")
        val context=InstrumentationRegistry.getInstrumentation().targetContext
        require(context.packageName=="dev.mote.collector.dev" && Build.FINGERPRINT.contains("/emu64a:"))
        val origin=requireNotNull(args.getString("fixtureOrigin"));require(Regex("http://127\\.0\\.0\\.1:[0-9]+").matches(origin))
        val owner="generated-managed-calendar-owner"
        fun request(path:String,body:JSONObject?=null):JSONObject {
            val (status,value)=HttpJson.request(if(body==null) "GET" else "POST",origin+path,body,owner)
            check(status in 200..299 && value!=null) { "Generated Central response $status for $path" };return value
        }
        val settings=Settings(context);val prior=settings.read();val prefs=context.getSharedPreferences("mote",Context.MODE_PRIVATE);val priorDevice=settings.deviceId
        require(!settings.enabled) { "Capture must already be disabled on this dedicated fixture" }
        val actions=CalendarActions(context);assertTrue("Calendar permission was explicitly granted on the fixture emulator",actions.permissions())
        assertEquals("No unrelated writable calendars exist on the dedicated AVD",0,actions.calendars().length())
        val owned=mutableListOf<android.net.Uri>();val resolver=context.contentResolver
        fun calendar():String {
            val account="generated-managed-${UUID.randomUUID()}"
            val uri=CalendarContract.Calendars.CONTENT_URI.buildUpon().appendQueryParameter(CalendarContract.CALLER_IS_SYNCADAPTER,"true").appendQueryParameter(CalendarContract.Calendars.ACCOUNT_NAME,account).appendQueryParameter(CalendarContract.Calendars.ACCOUNT_TYPE,CalendarContract.ACCOUNT_TYPE_LOCAL).build()
            val created=resolver.insert(uri,ContentValues().apply {
                put(CalendarContract.Calendars.ACCOUNT_NAME,account);put(CalendarContract.Calendars.ACCOUNT_TYPE,CalendarContract.ACCOUNT_TYPE_LOCAL)
                put(CalendarContract.Calendars.NAME,account);put(CalendarContract.Calendars.CALENDAR_DISPLAY_NAME,"Generated managed calendar")
                put(CalendarContract.Calendars.OWNER_ACCOUNT,account);put(CalendarContract.Calendars.CALENDAR_ACCESS_LEVEL,CalendarContract.Calendars.CAL_ACCESS_OWNER)
                put(CalendarContract.Calendars.VISIBLE,1);put(CalendarContract.Calendars.SYNC_EVENTS,1);put(CalendarContract.Calendars.CALENDAR_TIME_ZONE,"UTC")
            })!!
            val id=ContentUris.parseId(created);owned.add(uri.buildUpon().appendPath(id.toString()).build());return id.toString()
        }
        fun status(id:String)=request("/fixture/action/$id")
        fun change(id:String,kind:String)=request("/fixture/change",JSONObject().put("id",id).put("kind",kind))
        fun execute(id:String):JSONObject { val delivery=request("/fixture/delivery/$id");if(delivery.has("operationId"))actions.execute(id,delivery.getString("operationId"));return status(id) }
        fun event(id:String):JSONObject?=resolver.query(ContentUris.withAppendedId(CalendarContract.Events.CONTENT_URI,id.toLong()),arrayOf("_id","calendar_id","title","description","dtstart"),"deleted=0",null,null)!!.use { c -> if(!c.moveToFirst()) null else JSONObject().put("id",c.getString(0)).put("calendarId",c.getString(1)).put("title",c.getString(2)).put("description",c.getString(3)).put("start",c.getLong(4)) }
        val journal=File(context.noBackupFilesDir,"calendar-actions/${SourceRules.hash(origin+"generated-device")}")
        require(!journal.exists()) { "Generated operation journal must be new" }
        try {
            val selected=calendar();val other=calendar();val pair=request("/fixture/pair")
            check(prefs.edit().putString("deviceId",pair.getString("deviceId")).commit())
            settings.save(prior.copy(server=origin,token=pair.getString("token"),debugHttp=true,authSignedOut=false,authExpiresAt=0,authProcess="",syncMode="manual"),confirmCentralEndpoint=true)
            actions.deliver() // Publishes the actual two-calendar declaration, without a grant or a write.
            var grant=request("/fixture/grant",JSONObject().put("calendarId",selected))
            fun create():JSONObject { val a=request("/fixture/add",JSONObject());return execute(a.getString("id")).also { assertEquals("succeeded",it.getString("status"));assertEquals(selected,event(it.getString("externalId"))!!.getString("calendarId")) } }
            val original=create();val id=original.getString("id");val external=original.getString("externalId")
            val update=change(id,"calendar.update");execute(update.getString("id"));assertEquals("succeeded",status(update.getString("id")).getString("status"));assertEquals(external,status(update.getString("id")).getString("externalId"))
            assertEquals(java.time.Instant.parse("2099-09-19T15:00:00Z").toEpochMilli(),event(external)!!.getLong("start"));assertTrue(event(external)!!.getString("description").contains("[Mote:$id]"))
            val completed=create();val complete=change(completed.getString("id"),"calendar.complete");execute(complete.getString("id"));assertEquals("succeeded",status(complete.getString("id")).getString("status"));assertEquals("completed",status(completed.getString("id")).getString("resolution"));assertNotNull(event(completed.getString("externalId")))
            val cancel=change(id,"calendar.cancel");request("/fixture/receipts",JSONObject().put("blocked",true));assertThrows(IllegalStateException::class.java) { execute(cancel.getString("id")) };assertNull(event(external))
            request("/fixture/revoke",JSONObject().put("id",grant.getString("id")));request("/fixture/receipts",JSONObject().put("blocked",false));CalendarActions(context).deliver();CalendarActions(context).deliver()
            assertEquals("succeeded",status(cancel.getString("id")).getString("status"));assertEquals("cancelled",status(id).getString("resolution"));assertNull(event(external))
            grant=request("/fixture/grant",JSONObject().put("calendarId",selected))
            for(mutation in listOf("title","description","calendar_id")) {
                val a=create();val nativeId=a.getString("externalId");val values=ContentValues().apply { put(mutation,if(mutation=="calendar_id") other else "Generated owner-edited $mutation") }
                assertEquals(1,resolver.update(ContentUris.withAppendedId(CalendarContract.Events.CONTENT_URI,nativeId.toLong()),values,null,null))
                val proposal=change(a.getString("id"),"calendar.cancel");assertThrows(IllegalStateException::class.java) { execute(proposal.getString("id")) }
                assertNotNull("A changed native original must not be deleted",event(nativeId));assertEquals("uncertain",status(proposal.getString("id")).getString("status"))
                // This uncertain original is intentionally not retried during the next independent case.
                request("/fixture/revoke",JSONObject().put("id",grant.getString("id")))
                grant=request("/fixture/grant",JSONObject().put("calendarId",selected))
            }
        } finally {
            for(uri in owned.reversed())assertEquals("Only the generated calendar is removed",1,resolver.delete(uri,null,null))
            journal.deleteRecursively();check(prefs.edit().putString("deviceId",priorDevice).commit());settings.save(prior,confirmCentralEndpoint=true)
            assertEquals(0,actions.calendars().length());assertFalse(settings.enabled)
        }
    }
}
