package dev.mote.collector

/** Display-only formatting; original model text remains the export and persistence authority. */
internal object NativeAnswerPresentation {
    data class Emphasis(val start: Int, val end: Int, val bold: Boolean)
    data class Display(val text: String, val emphasis: List<Emphasis>)
    fun format(original: String, verifiedCitationIds: List<String>): Display {
        val numbers = verifiedCitationIds.distinct().withIndex().associate { it.value to it.index + 1 }
        var source = Regex("\\[([^]\\r\\n]+)]").replace(original) { match -> numbers[match.groupValues[1]]?.let { "[$it]" } ?: match.value }
        source = Regex("(?m)^[ \\t]*[-*+] +").replace(source, "• ")
        source = Regex("(?m)^#{1,6} +").replace(source, "")
        val output = StringBuilder(); val emphasis = mutableListOf<Emphasis>(); var offset = 0
        val marks = Regex("\\*\\*([^*\\n]+)\\*\\*|__([^_\\n]+)__|(?<!\\*)\\*([^*\\n]+)\\*(?!\\*)")
        for (match in marks.findAll(source)) {
            output.append(source, offset, match.range.first)
            val start = output.length; output.append(match.groups[1]?.value ?: match.groups[2]?.value ?: match.groups[3]!!.value)
            emphasis.add(Emphasis(start, output.length, match.groups[3] == null)); offset = match.range.last + 1
        }
        output.append(source, offset, source.length)
        return Display(output.toString(), emphasis)
    }
}
