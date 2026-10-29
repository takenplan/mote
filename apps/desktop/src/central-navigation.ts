import { moteText } from '@mote/shared/i18n';
import type { Config } from './contracts';
import { connectionToken, loginRequest } from './login-session';
import { openCentralBrowser } from './central-browser';

export type BrowserLogin = (page?: string, evidenceId?: string, durationMs?: number, workId?: string,conversationId?:string) => Promise<void>;
export interface CentralNavigation {
  settings(): Config;
  browserLogin(): BrowserLogin | undefined;
  ensureBrowserLogin(): Promise<void>;
  platform: string;
  launchChrome(url: string): Promise<unknown>;
  openDefault(url: string): Promise<unknown>;
}

/** The desktop's current browser entry: establish a device session, then hand off a short-lived ticket. */
export async function showCentral(navigation: CentralNavigation, page?: string, evidenceId?: string, workId?: string,conversationId?:string): Promise<void> {
  if (!connectionToken(navigation.settings())) {
    const login = navigation.browserLogin();
    if (login) return login(page, evidenceId, undefined, workId,conversationId);
    throw Error(moteText('请先登录中央节点，各页面会共用这次登录。'));
  }
  await navigation.ensureBrowserLogin();
  const { code } = await loginRequest(navigation.settings(), '/api/login/ticket', { expiresAt: navigation.settings().authExpiresAt }, connectionToken(navigation.settings()));
  await openCentralBrowser(navigation.settings().serverUrl, page, navigation.platform, navigation.launchChrome, navigation.openDefault, evidenceId, code, undefined, workId,conversationId);
}
