import { moteText } from '@mote/shared/i18n';
import type { Config } from './contracts';
import { connectionToken, loginRequest } from './login-session';
import { openCentralBrowser } from './central-browser';

export type BrowserLogin = (page?: string, evidenceId?: string, durationMs?: number, workId?: string,conversationId?:string) => Promise<void>;
export interface CentralNavigation {
  settings(): Config;
  authorizationGeneration(): number;
  browserLogin(): BrowserLogin | undefined;
  ensureBrowserLogin(): Promise<void>;
  platform: string;
  launchChrome(url: string): Promise<unknown>;
  openDefault(url: string): Promise<unknown>;
}

const changed = () => Error(moteText('登录会话已变更，请重新打开中央页面。'));
const sameLocation = (a: Config, b: Config) => a.serverUrl === b.serverUrl && a.deviceId === b.deviceId;
const sameSession = (a: Config, b: Config) => sameLocation(a,b) && a.token === b.token &&
  a.authSignedOut === b.authSignedOut && a.authExpiresAt === b.authExpiresAt &&
  a.authSessionOnly === b.authSessionOnly && a.authSourceBinding === b.authSourceBinding;

/** A delayed owner check may never install its credential into a different connection. */
export async function prepareBrowserSession(dependencies: {
  settings(): Config;
  authorizationGeneration(): number;
  inspect(config: Config): Promise<{credential:{id:string}}>;
  install(token:string,durationMs:number): Promise<void>;
}): Promise<void> {
  const selected = { ...dependencies.settings() }, generation = dependencies.authorizationGeneration();
  const token = connectionToken(selected);
  if (!token) return;
  const identity = await dependencies.inspect(selected);
  if (generation !== dependencies.authorizationGeneration() || !sameSession(selected,dependencies.settings()) || connectionToken(dependencies.settings()) !== token) throw changed();
  if (identity.credential.id === 'owner') {
    await dependencies.install(token,selected.authSessionOnly ? 0 : 2592000000);
    if (!sameLocation(selected,dependencies.settings())) throw changed();
  }
}

/** A late login grant belongs only to the connection that requested it. */
export async function pollBrowserLogin(dependencies: {
  current(): boolean;
  poll(): Promise<{ready?:boolean;token:string}>;
  install(token:string): Promise<void>;
  acknowledge(): Promise<unknown>;
  wait(): Promise<unknown>;
}, deadline = Date.now() + 10 * 60000): Promise<void> {
  while (Date.now() < deadline) {
    if (!dependencies.current()) throw changed();
    const grant = await dependencies.poll();
    if (!dependencies.current()) throw changed();
    if (grant.ready) {
      await dependencies.install(grant.token);
      await dependencies.acknowledge();
      return;
    }
    await dependencies.wait();
  }
  throw changed();
}

/** The desktop's current browser entry: establish a device session, then hand off a short-lived ticket. */
export async function showCentral(navigation: CentralNavigation, page?: string, evidenceId?: string, workId?: string,conversationId?:string): Promise<void> {
  const selected = { ...navigation.settings() };
  if (!connectionToken(selected)) {
    const login = navigation.browserLogin();
    if (login) return login(page, evidenceId, undefined, workId,conversationId);
    throw Error(moteText('请先登录中央节点，各页面会共用这次登录。'));
  }
  await navigation.ensureBrowserLogin();
  const prepared = { ...navigation.settings() }, token = connectionToken(prepared), generation = navigation.authorizationGeneration();
  if (!sameLocation(selected,prepared) || !token) throw changed();
  const ensureCurrent = () => {
    const current = navigation.settings();
    if (generation !== navigation.authorizationGeneration() || !sameSession(prepared,current) || connectionToken(current) !== token) throw changed();
  };
  const { code } = await loginRequest(prepared, '/api/login/ticket', { expiresAt: prepared.authExpiresAt }, token);
  ensureCurrent();
  await openCentralBrowser(prepared.serverUrl, page, navigation.platform,
    url => { ensureCurrent(); return navigation.launchChrome(url); },
    url => { ensureCurrent(); return navigation.openDefault(url); }, evidenceId, code, undefined, workId,conversationId);
}
