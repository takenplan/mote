import { moteText } from '@mote/shared/i18n';
import { AskClient } from './ask';
import type { Config } from './contracts';
import type { AskCommand } from './contracts/ask';
import type { BrowserLogin } from './central-navigation';

export interface AskDependencies {
  settings(): Config;
  installLogin(token: string, durationMs?: number): Promise<void>;
  endLogin(): Promise<void>;
  browserLogin: BrowserLogin;
}

/** Owns Ask command dispatch; the existing login transaction remains separately coordinated. */
export class AskController {
  private readonly client: AskClient;
  constructor(private readonly dependencies: AskDependencies) {
    this.client = new AskClient(config => {
      const current = dependencies.settings();
      return config.serverUrl === current.serverUrl && config.token === current.token && config.authSignedOut === current.authSignedOut && config.authExpiresAt === current.authExpiresAt;
    });
  }

  async request(command: unknown, input?: unknown): Promise<unknown> {
    const d = this.dependencies;
    if (command === 'login') {
      const value = input as { token?: string; durationMs?: number };
      if (typeof value?.token !== 'string' || value.token.length < 32 || value.token.length > 8192 || /[\r\n]/.test(value.token)) throw Error(moteText('请输入有效的中央所有者令牌'));
      await d.installLogin(value.token.trim(), value.durationMs); return {};
    }
    if (command === 'logout') { await d.endLogin(); return {}; }
    if (command === 'login-browser') { await d.browserLogin(undefined, undefined, (input as { durationMs?: number })?.durationMs); return {}; }
    try { return await this.client.request(d.settings(), command as AskCommand, input as Parameters<AskClient['request']>[2]); }
    catch (error) {
      if (error instanceof Error && error.message === moteText('令牌无效或已失效，请检查后重新登录。')) await d.endLogin();
      throw error;
    }
  }
}
