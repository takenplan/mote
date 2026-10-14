/** Managed workers are deployment resources. These values are a startup snapshot;
 * changing them requires restarting the node and its managed workers. */
export interface MediaRuntimeSettings {
  ocrEndpoint: string;
  asrEndpoint: string;
  workerToken: string;
}
export interface MediaConfiguration extends MediaRuntimeSettings {
  modelDirectory: string;
  python: string;
  ocrPort: number;
  asrPort: number;
}
export const DEFAULT_MEDIA_OCR_ENDPOINT = 'http://127.0.0.1:9010/ocr';
export const DEFAULT_MEDIA_ASR_ENDPOINT = 'http://127.0.0.1:9009/transcribe';
export function mediaRuntimeSettings(value?: Partial<MediaRuntimeSettings>): MediaRuntimeSettings {
  return {ocrEndpoint: DEFAULT_MEDIA_OCR_ENDPOINT, asrEndpoint: DEFAULT_MEDIA_ASR_ENDPOINT, workerToken: '', ...value};
}
