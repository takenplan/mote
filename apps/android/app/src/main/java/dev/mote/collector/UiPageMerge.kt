package dev.mote.collector

import org.json.JSONArray
import org.json.JSONObject

/** Only real observed identity and exact body overlap permit local accumulation. */
internal class UiPageMerge {
    private val previous=linkedMapOf<String,JSONObject>()
    @Synchronized fun reset()=previous.clear()
    private fun fields(page:JSONObject)=page.getJSONArray("objects").getJSONObject(0).getJSONArray("fields").let{a->(0 until a.length()).associate{i->val f=a.getJSONObject(i);f.getString("name") to f.getJSONArray("values")}}
    private fun strings(values:JSONArray?)=values?.let{a->(0 until a.length()).map{a.getJSONObject(it).getString("text")}}?:emptyList()
    private fun observedIdentity(name:String,values:JSONArray?):String? {
        if(values?.length()!=1)return null
        val value=values.getJSONObject(0)
        if(value.getString("source")=="state")return null
        val text=value.getString("text").takeIf {it.isNotBlank()}?:return null
        if(name=="item_id")return text
        if(!Regex("^https?://",RegexOption.IGNORE_CASE).containsMatchIn(text)||text.any {it.isWhitespace()||Character.isSpaceChar(it)||it=='\uFEFF'})return null
        return runCatching {
            val url=java.net.URI(text)
            text.takeIf {url.scheme?.lowercase() in setOf("http","https")&&!url.host.isNullOrBlank()&&url.rawUserInfo==null&&url.port in -1..65535}
        }.getOrNull()
    }
    private fun key(page:JSONObject,context:String):String? {
        val fields=fields(page)
        val identity=listOf("item_id","url").firstNotNullOfOrNull {name->observedIdentity(name,fields[name])?.let {name to it}}?:return null
        return JSONArray(listOf(context,page.getString("adapterId"),page.getString("adapterVersion"),page.getString("appVersion"),page.getJSONArray("objects").getJSONObject(0).getString("kind"),identity.first,identity.second)).toString()
    }
    @Synchronized fun merge(page:JSONObject,context:String):JSONObject {
        val old=key(page,context)?.let(previous::get)?:return page
        if(old.getJSONObject("observations").getInt("count")>=256)return page
        val before=fields(old);val after=fields(page)
        if((before.keys+after.keys).any{it!="body"&&before[it]?.toString()!=after[it]?.toString()})return page
        if(listOfNotNull(before["body"],after["body"]).any{a->(0 until a.length()).any{a.getJSONObject(it).getString("source")!="text"}})return page
        val first=strings(before["body"]);val next=strings(after["body"])
        if(first.isEmpty()||next.isEmpty())return page
        val merged=if(first==next)first else {
            val overlap=(minOf(first.size,next.size) downTo 1).firstOrNull{first.takeLast(it)==next.take(it)}
            if(overlap!=null)first+next.drop(overlap)
            else {
                val left=first.last();val right=next.first();val count=overlapCharacters(left,right)
                if(count<32)return page
                first.dropLast(1)+(left+right.drop(count))+next.drop(1)
            }
        }
        val headers=after.filterKeys {it!="body"}.values
        val allLength=merged.sumOf {it.length}+headers.sumOf {values->strings(values).sumOf {it.length}}
        if(merged.size>64||merged.size+headers.sumOf {it.length()}>128||allLength>64000||merged.any {it.length>32000})return page
        val values=JSONArray(merged.map {JSONObject().put("text",it).put("source","text")})
        val clipped=old.optBoolean("truncated")||page.optBoolean("truncated")
        val result=JSONObject(page.toString());val fs=result.getJSONArray("objects").getJSONObject(0).getJSONArray("fields")
        for(i in 0 until fs.length())if(fs.getJSONObject(i).getString("name")=="body")fs.getJSONObject(i).put("values",values)
        val times=result.getJSONObject("observations");times.put("firstAt",old.getJSONObject("observations").getString("firstAt")).put("count",old.getJSONObject("observations").getInt("count")+1)
        if(clipped)result.put("truncated",true).put("status","partial")
        return result
    }
    private fun overlapCharacters(left: String, right: String): Int {
        val limit = minOf(left.length, right.length)
        val size = right.length + 1 + limit
        val prefix = IntArray(size)
        fun value(index: Int): Int = when { index < right.length -> right[index].code; index == right.length -> -1; else -> left[left.length - limit + index - right.length - 1].code }
        for (i in 1 until size) {
            var matched = prefix[i - 1]
            while (matched > 0 && value(i) != value(matched)) matched = prefix[matched - 1]
            if (value(i) == value(matched)) matched++
            prefix[i] = matched
        }
        return prefix.last()
    }
    @Synchronized fun accepted(page:JSONObject,context:String){val id=key(page,context)?:return;previous.remove(id);previous[id]=JSONObject(page.toString());while(previous.size>8||previous.values.sumOf{UiPageRules.text(it).length}>256000)previous.remove(previous.keys.first())}
}
internal enum class UiPageOutcome { EXTRACTED, CAPTURED, SAVE_FAILED, EMPTY, PRIVACY_REJECTED, STATE_CHANGED, FAILED }
internal object UiPageCaptureChoice {
    fun screenshot(selected:Boolean,outcome:UiPageOutcome)=selected&&outcome !in setOf(UiPageOutcome.PRIVACY_REJECTED,UiPageOutcome.STATE_CHANGED)
}
