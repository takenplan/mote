"""Qwen recognition and forced alignment for already bounded mono PCM windows."""
import math
import unicodedata


SETTINGS = {'language': 'auto', 'temperature': 0, 'tokensPerSecond': 25,
            'tokenReserve': 128, 'minTokens': 256, 'maxTokens': 6144,
            'alignmentPaddingMs': 180}


def generate(model, samples):
    limit = min(SETTINGS['maxTokens'], max(SETTINGS['minTokens'],
                round(len(samples) / 16000 * SETTINGS['tokensPerSecond']) + SETTINGS['tokenReserve']))
    output = model.generate(samples, max_tokens=limit, temperature=SETTINGS['temperature'], verbose=False)
    return output, limit


def canonical_offsets(text):
    chars, offsets = [], []
    for offset, character in enumerate(text):
        for normalized in unicodedata.normalize('NFKC', character).casefold():
            if unicodedata.category(normalized)[0] in ('L', 'N'):
                chars.append(normalized)
                offsets.append(offset)
    return ''.join(chars), offsets


def align(model, samples, text, languages, start_ms, end_ms):
    """Attach real alignment spans only when all recognized wording is covered."""
    codes = {language for language in languages if isinstance(language, str) and language}
    if len(codes) != 1:
        return None
    source, offsets = canonical_offsets(text)
    if not source:
        return None
    try:
        output = model.generate(samples, text=text, language=next(iter(codes)))
    except (ValueError, RuntimeError, IndexError, TypeError):
        return None
    tokens = [(item, canonical_offsets(item.text)[0]) for item in output.items]
    if ''.join(chars for _, chars in tokens) != source:
        return None
    rows, position, previous = [], 0, 0
    duration_ms = end_ms - start_ms
    for item, chars in tokens:
        if not chars:
            continue
        start, end = item.start_time * 1000, item.end_time * 1000
        if not (math.isfinite(start) and math.isfinite(end) and
                previous <= start <= end <= duration_ms + SETTINGS['alignmentPaddingMs']):
            return None
        left = offsets[position] if position else 0
        position += len(chars)
        right = offsets[position] if position < len(offsets) else len(text)
        if left >= right or start >= duration_ms:
            return None
        rows.append({'startMs': start_ms + start, 'endMs': min(start_ms + end, end_ms),
                     'text': text[left:right]})
        previous = start
    return rows
