package dev.mote.collector

/** Display-only formatting; original model text remains the export and persistence authority. */
internal object NativeAnswerPresentation {
    data class Emphasis(val start: Int, val end: Int, val bold: Boolean)
    data class Citation(val start: Int, val end: Int, val id: String, val number: Int)
    data class Display(val text: String, val emphasis: List<Emphasis>, val citations: List<Citation> = emptyList())

    private fun escaped(text: String, position: Int): Boolean {
        var index = position - 1
        while (index >= 0 && text[index] == '\\') index--
        return (position - index - 1) % 2 == 1
    }

    /** Exclude code and authored links from the verified citation transformation. */
    private fun protectedText(text: String): BooleanArray {
        val blocked = BooleanArray(text.length)
        fun mark(start: Int, end: Int) { for (index in start until end.coerceAtMost(text.length)) blocked[index] = true }
        val fence = Regex("^[ \\t]{0,3}(?:>[ \\t]?)*(?:(?:[-*+•]|[0-9]+[.)])[ \\t]+)?(`{3,}|~{3,})")
        var fenceChar: Char? = null; var fenceSize = 0; var lineStart = 0
        while (lineStart < text.length) {
            val next = text.indexOf('\n', lineStart).let { if (it < 0) text.length else it + 1 }
            val line = text.substring(lineStart, next)
            val match = fence.find(line); val marker = match?.groupValues?.get(1)
            if (fenceChar != null) {
                mark(lineStart, next)
                if (marker != null && marker.first() == fenceChar && marker.length >= fenceSize && line.substring(requireNotNull(match).range.last + 1).isBlank()) fenceChar = null
            } else if (marker != null) {
                fenceChar = marker.first(); fenceSize = marker.length; mark(lineStart, next)
            } else if (line.startsWith("    ") || line.startsWith("\t")) {
                mark(lineStart, next)
            }
            lineStart = next
        }
        var index = 0
        while (index < text.length) {
            if (!blocked[index] && text[index] == '`' && !escaped(text,index)) {
                var endRun = index + 1
                while (endRun < text.length && text[endRun] == '`') endRun++
                val delimiter = text.substring(index, endRun)
                var close = text.indexOf(delimiter, endRun)
                while (close >= 0 && ((close > 0 && text[close - 1] == '`') || (close + delimiter.length < text.length && text[close + delimiter.length] == '`'))) close = text.indexOf(delimiter, close + 1)
                if (close >= 0) {
                    mark(index, close + delimiter.length); index = close + delimiter.length; continue
                }
            }
            index++
        }
        val authoredLink = Regex("!?\\[(?:\\\\.|[^]\\\\])*]\\((?:\\\\.|[^)\\\\])*\\)|!?\\[(?:\\\\.|[^]\\\\])*]\\[(?:\\\\.|[^]\\\\])*]")
        authoredLink.findAll(text).forEach { match -> if (!escaped(text,match.range.first)) mark(match.range.first,match.range.last + 1) }
        return blocked
    }

    private fun prepareLines(original: String): String {
        val output = StringBuilder(); val fence = Regex("^[ \\t]{0,3}(?:>[ \\t]?)*(?:(?:[-*+•]|[0-9]+[.)])[ \\t]+)?(`{3,}|~{3,})")
        var fenceChar: Char? = null; var fenceSize = 0; var start = 0
        while (start < original.length) {
            val next = original.indexOf('\n', start).let { if (it < 0) original.length else it + 1 }
            val line = original.substring(start, next); val match = fence.find(line); val marker = match?.groupValues?.get(1)
            val inCode = fenceChar != null || marker != null
            if (fenceChar != null && marker != null && marker.first() == fenceChar && marker.length >= fenceSize && line.substring(requireNotNull(match).range.last + 1).isBlank()) fenceChar = null
            else if (fenceChar == null && marker != null) { fenceChar = marker.first(); fenceSize = marker.length }
            output.append(if (inCode || line.startsWith("    ") || line.startsWith("\t")) line else line.replace(Regex("^[ \\t]{0,3}>[ \\t]?"), "")
                .replace(Regex("^[ \\t]*[-*+] +"), "• ").replace(Regex("^#{1,6} +"), ""))
            start = next
        }
        return output.toString()
    }
    fun format(original: String, verifiedCitationIds: List<String>): Display {
        val numbers = verifiedCitationIds.distinct().withIndex().associate { it.value to it.index + 1 }
        val source = prepareLines(original)
        val sourceProtected = protectedText(source)
        val prose = StringBuilder(); val emphasis = mutableListOf<Emphasis>(); var offset = 0
        val marks = Regex("\\*\\*([^*\\n]+)\\*\\*|__([^_\\n]+)__|(?<!\\*)\\*([^*\\n]+)\\*(?!\\*)")
        for (match in marks.findAll(source)) {
            if (escaped(source,match.range.first) || match.range.any { sourceProtected[it] }) continue
            prose.append(source, offset, match.range.first)
            val start = prose.length; prose.append(match.groups[1]?.value ?: match.groups[2]?.value ?: match.groups[3]!!.value)
            emphasis.add(Emphasis(start, prose.length, match.groups[3] == null)); offset = match.range.last + 1
        }
        prose.append(source, offset, source.length)
        val text = prose.toString(); val blocked = protectedText(text); val output = StringBuilder(); val citations = mutableListOf<Citation>()
        val references = Regex("(?m)^[ \\t]{0,3}\\[([^]\\r\\n]+)]:[ \\t]*\\S.*$").findAll(text)
            .filter { !blocked[it.range.first] }.map { it.groupValues[1].trim().lowercase() }.toSet()
        data class Replacement(val start: Int, val end: Int, val length: Int)
        val replacements = mutableListOf<Replacement>(); offset = 0
        for (match in Regex("\\[([^]\\r\\n]+)]").findAll(text)) {
            if (escaped(text,match.range.first) || match.range.any { blocked[it] } || text.getOrNull(match.range.last + 1) in listOf('(', '[')) continue
            val id = match.groupValues[1]; val number = numbers[id] ?: continue
            if (id.trim().lowercase() in references || (match.range.first > 0 && text[match.range.first - 1] == '!')) continue
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
