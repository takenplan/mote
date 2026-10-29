package dev.mote.collector

/** Display-only formatting; original model text remains the export and persistence authority. */
internal object NativeAnswerPresentation {
    data class Emphasis(val start: Int, val end: Int, val bold: Boolean)
    data class Citation(val start: Int, val end: Int, val id: String, val number: Int)
    data class Display(val text: String, val emphasis: List<Emphasis>, val citations: List<Citation> = emptyList())
    fun format(original: String, verifiedCitationIds: List<String>): Display {
        val numbers = verifiedCitationIds.distinct().withIndex().associate { it.value to it.index + 1 }
        var source = original
        run {
            source = Regex("(?m)^[ \\t]*[-*+] +").replace(source, "• ")
            source = Regex("(?m)^#{1,6} +").replace(source, "")
        }
        val prose = StringBuilder(); val emphasis = mutableListOf<Emphasis>(); var offset = 0
        val marks = Regex("\\*\\*([^*\\n]+)\\*\\*|__([^_\\n]+)__|(?<!\\*)\\*([^*\\n]+)\\*(?!\\*)")
        for (match in marks.findAll(source)) {
            prose.append(source, offset, match.range.first)
            val start = prose.length; prose.append(match.groups[1]?.value ?: match.groups[2]?.value ?: match.groups[3]!!.value)
            emphasis.add(Emphasis(start, prose.length, match.groups[3] == null)); offset = match.range.last + 1
        }
        prose.append(source, offset, source.length)
        val text = prose.toString(); val output = StringBuilder(); val citations = mutableListOf<Citation>()
        data class Replacement(val start: Int, val end: Int, val length: Int)
        val replacements = mutableListOf<Replacement>(); offset = 0
        for (match in Regex("\\[([^]\\r\\n]+)]").findAll(text)) {
            val id = match.groupValues[1]; val number = numbers[id] ?: continue
            output.append(text, offset, match.range.first)
            val start = output.length; val label = "[$number]"; output.append(label)
            citations.add(Citation(start, output.length, id, number))
            replacements.add(Replacement(match.range.first, match.range.last + 1, label.length)); offset = match.range.last + 1
        }
        output.append(text, offset, text.length)
        fun translated(position: Int): Int {
            var delta = 0
            for (replacement in replacements) {
                if (position <= replacement.start) break
                if (position < replacement.end) return replacement.start + delta + if (position == replacement.start) 0 else replacement.length
                delta += replacement.length - (replacement.end - replacement.start)
            }
            return position + delta
        }
        return Display(output.toString(), emphasis.map { Emphasis(translated(it.start), translated(it.end), it.bold) }, citations)
    }
}
