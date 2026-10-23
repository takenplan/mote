import { probeRuntimeListener } from './runtime-listener.js';
const file = process.env.MOTE_CONFIG_FILE;
void (file ? probeRuntimeListener(file, {checkLocalPid: !process.argv.slice(2).includes('--shared-network')}) : Promise.resolve(false)).then(healthy => { process.exitCode = healthy ? 0 : 1; }, () => { process.exitCode = 1; });
