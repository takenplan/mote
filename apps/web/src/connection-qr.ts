/** Connection codes always use dark modules on a light background, independent of the UI theme. */
export async function connectionQrDataUrl(uri: string): Promise<string> {
    const {default:QRCode} = await import('qrcode');
    return QRCode.toDataURL(uri, {width:360,margin:4,errorCorrectionLevel:'M'});
}
