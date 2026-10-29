// Environment for the deployment-owned Docker media sidecars.
export function mediaEnvironment(env) {
  const clean=Object.fromEntries(['PATH', 'HOME', 'LANG', 'TMPDIR', 'TMP', 'TEMP'].filter(key => env[key] !== undefined).map(key => [key, env[key]]));
  // GUI/launchd processes need the standard Native package-manager locations.
  // Preserve configured search order and never forward credentials.
  if(env.MOTE_RUNTIME==='native'&&process.platform==='darwin')clean.PATH=[...new Set([...(clean.PATH??'/usr/bin:/bin:/usr/sbin:/sbin').split(':'),'/opt/homebrew/bin','/usr/local/bin'])].join(':');
  return clean;
}
