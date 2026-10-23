package dev.mote.collector

import com.google.zxing.BarcodeFormat
import com.google.zxing.DecodeHintType
import com.google.zxing.InvertedLuminanceSource
import com.google.zxing.LuminanceSource
import com.google.zxing.RGBLuminanceSource
import com.google.zxing.common.BitMatrix
import com.google.zxing.qrcode.QRCodeWriter
import com.journeyapps.barcodescanner.Decoder
import com.journeyapps.barcodescanner.DefaultDecoderFactory
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/**
 * Regression for the user-discovered scan failure: connection QRs were rendered
 * inverted (light modules on dark) and the scanner only tried normal polarity.
 * MIXED_SCAN makes the factory produce a MixedDecoder that alternates polarity
 * across preview frames, so both orientations decode. Decoder.decode returns
 * null on failure instead of throwing.
 */
class ConnectionScanDecodeTest {
    private val content = "mote://connect?data=generated-connection-invitation"
    private val size = 240

    private fun source(inverted: Boolean): RGBLuminanceSource {
        val matrix: BitMatrix = QRCodeWriter().encode(content, BarcodeFormat.QR_CODE, size, size)
        val dark = 0xFF000000.toInt()
        val light = 0xFFFFFFFF.toInt()
        val pixels = IntArray(size * size)
        for (y in 0 until size) for (x in 0 until size) {
            val isDark = if (inverted) !matrix.get(x, y) else matrix.get(x, y)
            pixels[y * size + x] = if (isDark) dark else light
        }
        return RGBLuminanceSource(size, size, pixels)
    }

    private fun scanDecoder(): Decoder = connectionScanDecoderFactory()
        .createDecoder(mutableMapOf<DecodeHintType, Any>())

    private fun attempt(decoder: Decoder, frame: LuminanceSource, tries: Int = 2): String? =
        (0 until tries).firstNotNullOfOrNull { decoder.decode(frame)?.text }

    @Test fun mixedDecoderReadsNormalAndInvertedQr() {
        val decoder = scanDecoder()
        assertEquals(content, attempt(decoder, source(inverted = false)))
        assertEquals(content, attempt(decoder, source(inverted = true)))
    }

    @Test fun previousNormalOnlyDecoderRejectedInvertedQr() {
        val decoder = DefaultDecoderFactory(listOf(BarcodeFormat.QR_CODE)).createDecoder(mutableMapOf<DecodeHintType, Any>())
        assertEquals(content, attempt(decoder, source(inverted = false)))
        assertNull(attempt(decoder, source(inverted = true)))
        // Sanity: the same inverted fixture decodes once luminance is flipped,
        // which is the extra pass MIXED_SCAN adds on alternate preview frames.
        assertEquals(content, decoder.decode(InvertedLuminanceSource(source(inverted = true)))?.text)
    }
}
