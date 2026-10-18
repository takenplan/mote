// Only empty named-volume roots are initialized automatically. Existing files require an explicit offline operation.
import { lstat, readdir, chown } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { resolve, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
export function parseStorageOwner(user) {
  if (typeof user !== 'string' || !/^\d+:\d+$/.test(user)) throw Error('Invalid storage owner');
  const [uid, gid] = user.split(':').map(Number);
  if (![uid, gid].every(value => Number.isSafeInteger(value) && value >= 0 && value < 4294967295)) throw Error('Invalid storage owner');
  return { uid, gid };
}
export async function storageOwnerPlan(user, directories, io = { lstat, readdir }) {
  const owner = parseStorageOwner(user), initialize = [];
  for (const directory of directories) {
    if (!isAbsolute(directory)) throw Error('Invalid storage directory');
    const metadata = await io.lstat(directory);
    if (!metadata.isDirectory() || metadata.isSymbolicLink()) throw Error('Invalid storage directory');
    if (metadata.uid === owner.uid && metadata.gid === owner.gid) continue;
    if ((await io.readdir(directory)).length) throw Error('Stored volume ownership differs from this profile owner. Stop the profile, preserve an offline backup, then run migrate-storage-owner explicitly. No volume files were changed.');
    initialize.push(directory);
  }
  return { ...owner, initialize };
}
export async function main(args = process.argv.slice(2)) {
  const migrate = args[0] === '--migrate';
  if (migrate) args = args.slice(1);
  const [user, ...directories] = args; const owner = parseStorageOwner(user);
  if (!directories.length || directories.some(value => !isAbsolute(value))) throw Error('Owned volume directories are required');
  if (migrate) {
    await new Promise((resolveMigration, reject) => {
      const child = spawn('chown', ['-R', user, ...directories], { stdio: 'ignore' });
      child.once('error', reject); child.once('close', code => code === 0 ? resolveMigration() : reject(Error('Storage ownership migration failed; the profile remains stopped')));
    });
  } else {
    // Validate every volume before changing even an empty root.
    const plan = await storageOwnerPlan(user, directories);
    for (const directory of plan.initialize) await chown(directory, owner.uid, owner.gid);
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message.startsWith('Stored volume ownership') ? error.message : 'Storage ownership preparation failed; no Central service was started'); process.exitCode = 1; });
}
