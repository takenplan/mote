package dev.mote.collector

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import org.json.JSONObject
import kotlin.math.ceil
import kotlin.math.floor

object ImagePrivacy {
    fun applyMasks(bitmap: Bitmap, masks: List<Mask>) {
        val canvas = Canvas(bitmap)
        val paint = Paint().apply { color = Color.BLACK; isAntiAlias = false }
        masks.forEach { canvas.drawRect(floor(it.left * bitmap.width), floor(it.top * bitmap.height), ceil(it.right * bitmap.width), ceil(it.bottom * bitmap.height), paint) }
    }
    /** Keep OCR inside the inspected foreground root; overlays and private inputs stay black. */
    fun applyOcrRegions(bitmap:Bitmap,snapshot:JSONObject):Boolean {
        if(!snapshot.optBoolean("ocrSafe"))return false
        val v=snapshot.optJSONObject("ocrViewport")?:return false
        if(v.optInt("width")<=0||v.optInt("height")<=0)return false
        val canvas=Canvas(bitmap);val paint=Paint().apply{color=Color.BLACK;isAntiAlias=false}
        val left=v.getInt("x").coerceIn(0,bitmap.width);val top=v.getInt("y").coerceIn(0,bitmap.height)
        val right=(v.getInt("x")+v.getInt("width")).coerceIn(left,bitmap.width);val bottom=(v.getInt("y")+v.getInt("height")).coerceIn(top,bitmap.height)
        if(right==left||bottom==top)return false
        canvas.drawRect(0f,0f,bitmap.width.toFloat(),top.toFloat(),paint);canvas.drawRect(0f,bottom.toFloat(),bitmap.width.toFloat(),bitmap.height.toFloat(),paint)
        canvas.drawRect(0f,top.toFloat(),left.toFloat(),bottom.toFloat(),paint);canvas.drawRect(right.toFloat(),top.toFloat(),bitmap.width.toFloat(),bottom.toFloat(),paint)
        val regions=snapshot.optJSONArray("ocrMasks")?:org.json.JSONArray()
        for(i in 0 until regions.length()){val r=regions.getJSONObject(i);canvas.drawRect(r.getInt("x").toFloat(),r.getInt("y").toFloat(),(r.getInt("x")+r.getInt("width")).toFloat(),(r.getInt("y")+r.getInt("height")).toFloat(),paint)}
        return true
    }
}
