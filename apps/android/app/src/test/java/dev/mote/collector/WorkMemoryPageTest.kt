package dev.mote.collector

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class WorkMemoryPageTest {
    private val ids=(1..23).map{String.format("00000000-0000-4000-8000-%012d",it)}
    private fun page(ids:List<String>,total:Any=23,next:Any=JSONObject.NULL)=JSONObject().put("ids",JSONArray(ids)).put("total",total).put("nextCursor",next)
    @Test fun `result pages preserve exact ordered IDs and cursor`() {
        val first=WorkMemoryPage.read(page(ids.take(20),next=ids[19]),null)
        assertEquals(ids.take(20),first.ids);assertEquals(ids[19],first.next);assertEquals(23,first.total)
        assertEquals(ids.drop(20),WorkMemoryPage.read(page(ids.drop(20)),first.next).ids)
    }
    @Test fun `malformed or cyclic result pages are rejected`() {
        val bad=listOf(page(listOf(ids[0],ids[0])),page(listOf(ids[1],ids[0])),page(listOf("not-a-uuid")),page(ids.take(2),total=1),page(ids.take(2),next=ids[0]),JSONObject().put("ids",JSONArray(ids.take(2))).put("total",23))
        bad.forEach { value->assertThrows(IllegalArgumentException::class.java){WorkMemoryPage.read(value,null)} }
        assertThrows(IllegalArgumentException::class.java){WorkMemoryPage.read(page(ids.take(2)),ids[0])}
    }
    @Test fun `the exact snapshot includes text, evidence and a valid fingerprint`() {
        fun row()=JSONObject().put("id",ids[0]).put("version",1).put("status","published").put("fingerprint","a".repeat(64)).put("title","title").put("statement","statement").put("uncertainty","").put("evidenceIds",JSONArray().put(ids[1]))
        val original=WorkMemoryReference.identity(ids[0],row());assertNotNull(original)
        assertNotEquals(original,WorkMemoryReference.identity(ids[0],row().put("statement","other")))
        assertNotEquals(original,WorkMemoryReference.identity(ids[0],row().put("evidenceIds",JSONArray().put(ids[2]))))
        assertNull(WorkMemoryReference.identity(ids[0],row().put("fingerprint","")))
        assertNull(WorkMemoryReference.identity(ids[0],row().put("evidenceIds",JSONArray())))
        assertNull(WorkMemoryReference.identity(ids[1],row()))
    }
}
