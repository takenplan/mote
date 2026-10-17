package dev.mote.collector
import android.content.Context
import java.net.URLEncoder
/** One bounded pull during an existing sync; no additional recurring wakeup. */
object PerceptionSync {
 fun pull(context: Context, settings: Settings, config: CollectorConfig, queue: DurableQueue) {
  val prefs=context.accountPreferences("central-perception")
  val key=SourceRules.hash(config.ownerKey()+"\n"+settings.deviceId)
  val cursor=prefs.getLong(key,0)
  SyncSchedule.requireConditions(context,config)
  val ingress=context.ingress3(config)
  val path="/api/ingress/devices/${URLEncoder.encode(settings.deviceId,"UTF-8")}/updates?limit=20&cursor="
  var from=cursor
  val body=try {ingress.send("GET",path+from)} catch(error:FileTransportFailure) {
   if(error.httpStatus!=409||error.code!="invalid_cursor")throw error
   // A restored instance can have an earlier derived journal. Never reset it
   // merely because the URL stayed the same: re-confirm this exact identity.
   ingress.verify();from=0;ingress.send("GET",path+from)
  }
  val value=body.get("nextCursor");require(value is Number)
  val next=value.toLong();require(value.toDouble()==next.toDouble()&&next>=from&&next<=9007199254740991L)
  val items=body.getJSONArray("items");require(items.length()<=20)
  check(ConnectionGuard.sync {
   check(Settings(context).read().let {it.account()==config.account()&&it.connectionToken()==config.connectionToken()&&it.hasSyncConnection()})
   for(i in 0 until items.length())queue.cacheCentralDerived(items.getJSONObject(i),config.maxQueueMiB*1024L*1024L)
   check(prefs.edit().putLong(key,next).commit());true
  }==true)
 }
}
