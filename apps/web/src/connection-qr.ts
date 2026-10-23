import type QRCode from 'qrcode';

/**
 * Connection invitation QR rendering options. Scanners must read this code, so
 * it stays dark-on-light (the qrcode library defaults); themed color overrides
 * inverted the modules and broke Android scanning.
 */
export const connectionQrOptions: QRCode.QRCodeToDataURLOptions = {
    width: 360,
    margin: 4,
    errorCorrectionLevel: 'M',
};
