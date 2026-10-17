/** Device-local appearance. Never persist the resolved OS color as the user's choice. */
export type AppearancePreference = 'light' | 'dark' | 'auto';
export type ColorScheme = 'light' | 'dark';
export type AppearanceSnapshot = Readonly<{ preference: AppearancePreference; scheme: ColorScheme }>;
export const appearanceStorageKey = 'mote.appearance.v1';
export function appearancePreference(value: unknown): AppearancePreference {
  return value === 'light' || value === 'dark' ? value : 'auto';
}
export function resolveColorScheme(preference: AppearancePreference, systemDark: boolean): ColorScheme {
  return preference === 'auto' ? systemDark ? 'dark' : 'light' : preference;
}
export class AppearanceStore {
  private preference: AppearancePreference;
  private systemDark: boolean;
  private snapshot: AppearanceSnapshot;
  private readonly listeners = new Set<() => void>();
  constructor(preference: unknown = 'auto', systemDark = false) {
    this.preference = appearancePreference(preference); this.systemDark = systemDark;
    this.snapshot = this.resolve();
  }
  private resolve(): AppearanceSnapshot { return Object.freeze({preference:this.preference,scheme:resolveColorScheme(this.preference,this.systemDark)}); }
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish() {
    const next = this.resolve();
    if (next.preference === this.snapshot.preference && next.scheme === this.snapshot.scheme) return;
    this.snapshot = next; for (const listener of this.listeners) listener();
  }
  select(value: unknown) { this.preference = appearancePreference(value); this.publish(); }
  systemChanged(dark: boolean) { this.systemDark = dark; this.publish(); }
}

/** No window access during server imports. Storage denial and malformed values both follow the OS. */
export function createBrowserAppearance(browser?: Window) {
  let media: MediaQueryList | undefined;
  try { media = browser?.matchMedia?.('(prefers-color-scheme: dark)'); } catch { /* Unsupported host. */ }
  const read = () => { try { return browser?.localStorage.getItem(appearanceStorageKey); } catch { return 'auto'; } };
  const store = new AppearanceStore(read(),media?.matches ?? false);
  const system = () => store.systemChanged(media?.matches ?? false);
  const resume = () => { system(); store.select(read()); };
  const storage = (event: StorageEvent) => { if (event.key === appearanceStorageKey || event.key === null) { system(); store.select(read()); } };
  media?.addEventListener('change',system);
  browser?.addEventListener('storage',storage);
  browser?.addEventListener('pageshow',resume);
  browser?.document.addEventListener('visibilitychange',resume);
  return Object.assign(store,{
    save(value: unknown): boolean {
      const preference = appearancePreference(value);
      system();
      try { browser?.localStorage.setItem(appearanceStorageKey,preference); store.select(preference); return Boolean(browser); }
      catch { store.select('auto'); return false; }
    },
    dispose() { media?.removeEventListener('change',system); browser?.removeEventListener('storage',storage); browser?.removeEventListener('pageshow',resume); browser?.document.removeEventListener('visibilitychange',resume); },
  });
}
