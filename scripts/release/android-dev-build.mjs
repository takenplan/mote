/** A workflow run is one immutable Dev distribution; reruns repair its draft. */
export function androidDevBuild(version, env = process.env) {
  const value = env.MOTE_ANDROID_DEV_RUN;
  if (value === undefined || value === '') return undefined;
  if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) > 1_100_000_000) {
    throw Error('Invalid Android Dev workflow run number');
  }
  const run = Number(value);
  return {
    run, versionCode: 1_000_000_000 + run, versionName: `${version}-dev.${run}`,
    name: `mote-android-dev-arm64-${version}-build.${run}.apk`,
  };
}

export function androidDevTag(build, commit) {
  if (!build || !/^[a-f0-9]{40}$/.test(commit)) throw Error('Android Dev publication requires a workflow build and exact commit');
  return `android-dev-${build.run}-${commit.slice(0, 12)}`;
}
