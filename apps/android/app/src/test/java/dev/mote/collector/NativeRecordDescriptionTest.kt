package dev.mote.collector

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class NativeRecordDescriptionTest {
    private val id="0614f9ca-c290-40ba-9f40-ab5313d021a8"
    private fun declaration()=JSONObject().put("captureId",id).put("version",1).put("fingerprint","a".repeat(64))
    private fun statement(text:String="Original separate description")=JSONObject().put("captureId",id).put("version",1).put("description",text)
    private fun record(declarations:JSONArray=JSONArray().put(declaration()),statements:JSONArray=JSONArray().put(statement()))=JSONObject().put("id",id).put("ocrText","Literal original body").put("metadata",JSONObject().put("ownerDescription","Local independent draft")).put("attributionContext",JSONObject().put("recordContextDeclarations",declarations).put("recordContextStatements",statements))
    @Test fun localMetadataAndCentralFrozenDeclarationRemainSeparateWithoutChangingTheBody(){
        val row=record();assertEquals(listOf("Local independent draft"),NativeRecordDescription.read(row,false));assertEquals(listOf("Original separate description"),NativeRecordDescription.read(row,true));assertEquals("Literal original body",row.getString("ocrText"))
        row.remove("attributionContext");assertTrue("A remote reader must not fall back to local-input metadata",NativeRecordDescription.read(row,true).isEmpty())
    }
    @Test fun sourceDescriptionsNeverBecomeRecordDescriptionsAndUndeclaredStatementsAreHidden(){
        val row=record(JSONArray());row.getJSONObject("attributionContext").put("sourceContextStatements",JSONArray().put(JSONObject().put("sourceId","source").put("version",1).put("description","Source scope only")));assertTrue(NativeRecordDescription.read(row,true).isEmpty())
    }
    @Test fun exactDeclaredParentContextCanBeReadButChangedVersionOrMalformedPinCannot(){
        val row=record().put("id","7972977a-4e68-4b99-9574-e5aee1fbe173");assertEquals(listOf("Original separate description"),NativeRecordDescription.read(row,true))
        for(value in listOf(statement().put("version",1.5),statement().put("captureId","different"),statement().put("version",2)))assertTrue(NativeRecordDescription.read(record(statements=JSONArray().put(value)),true).isEmpty())
        assertTrue(NativeRecordDescription.read(record(declarations=JSONArray().put(declaration().put("fingerprint","bad"))),true).isEmpty())
    }
    @Test fun conflictingSamePinStatementsAreNeverChosenArbitrarily(){
        assertTrue(NativeRecordDescription.read(record(statements=JSONArray().put(statement("one")).put(statement("two"))),true).isEmpty());assertEquals(listOf("Original separate description"),NativeRecordDescription.read(record(statements=JSONArray().put(statement()).put(statement())),true))
    }
}
