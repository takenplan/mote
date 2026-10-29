package dev.mote.collector

import org.junit.Assert.*
import org.junit.Test

class NativeAnswerPresentationTest {
    @Test fun `only exact verified citations receive stable display numbers while original export stays untouched`() {
        val id = "2fe73d52-265e-472f-9211-1c1f70476139"; val unknown = "785f6960-59fc-43a6-9713-383cb9960162"
        val original = "**Answer** [$id] [$unknown] [$id-extra] [$id]"
        val rendered = NativeAnswerPresentation.format(original, listOf(id, id))
        assertEquals("Answer [1] [$unknown] [$id-extra] [1]", rendered.text)
        assertEquals("**Answer** [$id] [$unknown] [$id-extra] [$id]", original)
        assertEquals(listOf(NativeAnswerPresentation.Emphasis(0, 6, true)), rendered.emphasis)
    }
    @Test fun `native formatting supports emphasis and bullets and keeps literal HTML inert`() {
        val rendered = NativeAnswerPresentation.format("- **Strong** and *soft*\n<script>alert('literal')</script>", emptyList())
        assertEquals("• Strong and soft\n<script>alert('literal')</script>", rendered.text)
        assertEquals("Strong", rendered.text.substring(rendered.emphasis[0].start, rendered.emphasis[0].end))
        assertTrue(rendered.emphasis[0].bold); assertFalse(rendered.emphasis[1].bold)
    }
    @Test fun `generated media labels require native identity and never hide a user filename`() {
        val name = "photo-12345.jpg"; val owned = java.util.UUID.nameUUIDFromBytes(name.toByteArray()).toString()
        assertEquals("照片", NativeRecordAttachmentLabels.generatedKind(owned, name, "image/jpeg"))
        assertNull(NativeRecordAttachmentLabels.generatedKind(java.util.UUID.randomUUID().toString(), name, "image/jpeg"))
    }

    @Test fun `verified inline ranges preserve identity across formatting without making literal numbers clickable`() {
        val first="2fe73d52-265e-472f-9211-1c1f70476139"; val second="785f6960-59fc-43a6-9713-383cb9960162"
        val original="## **Plan [$second]** and *review [$first]*. Literal [1]. Repeat [$second]."
        val formatted=NativeAnswerPresentation.format(original,listOf(first,second,first))
        assertEquals("Plan [2] and review [1]. Literal [1]. Repeat [2].",formatted.text)
        assertEquals(listOf(second,first,second),formatted.citations.map { it.id })
        assertEquals(listOf("[2]","[1]","[2]"),formatted.citations.map { formatted.text.substring(it.start,it.end) })
        assertEquals(listOf("Plan [2]","review [1]"),formatted.emphasis.map { formatted.text.substring(it.start,it.end) })
        assertTrue(original.contains(first)); assertTrue(original.contains(second))
    }

}
