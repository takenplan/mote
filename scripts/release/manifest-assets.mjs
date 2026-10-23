// CI metadata also includes build provenance. Only the existing signed wire
// fields belong in the manifest consumed by the strict release verifiers.
const fields = ['component', 'platform', 'arch', 'format', 'name', 'url', 'size', 'sha256', 'versionCode', 'packageName', 'certificateSha256', 'bundleId', 'signing', 'teamId'];
export function manifestAsset(metadata) {
  return Object.fromEntries(fields.filter(field => Object.hasOwn(metadata, field)).map(field => [field, metadata[field]]));
}
