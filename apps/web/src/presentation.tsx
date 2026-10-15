import { UiPresentationHost, defaultUiLayout, linearUiTheme, type UiLayoutProfile } from '@mote/shared';
import React, { useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { revealWorkspaceFocus } from './workspace-focus';
import { moteText } from '@mote/shared/i18n';

/** Trusted, compiled renderers receive presentation slots, never control session or job lifetimes. */
export type WebShellProps = {
  layout: UiLayoutProfile;
  navigation: ReactNode;
  toolbar: ReactNode;
  footer: ReactNode;
  content: ReactNode;
};
export type WebShellRenderer = React.ComponentType<WebShellProps>;

export function WorkspaceShell({ layout, navigation, toolbar, content, footer }: WebShellProps) {
  return <div className="app-shell" data-navigation={layout.navigation} data-detail={layout.detail}>
    {navigation}
    <main className="main" onFocusCapture={event => revealWorkspaceFocus(event.target)}>
      {toolbar}{content}{footer}
    </main>
  </div>;
}

export const webPresentation = new UiPresentationHost<WebShellRenderer>({
  theme: linearUiTheme,
  layout: { ...defaultUiLayout, implementation: WorkspaceShell },
});

/** Moving this stable portal container preserves fields, React state and pending work across shells. */
function ContentOutlet({ container }: { container: HTMLElement }) {
  const target = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => { target.current?.appendChild(container); }, [container]);
  return <div ref={target} className="presentation-content-outlet"/>;
}

class ShellBoundary extends React.Component<{ renderer: WebShellRenderer; slots: WebShellProps }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    const Renderer = this.state.failed ? WorkspaceShell : this.props.renderer;
    return <><Renderer {...this.props.slots}/>{this.state.failed&&<p role="status" className="notice">{moteText('专用视图暂不可用，请查看资料库或重试。')}</p>}</>;
  }
}

export function PresentationSurface({ navigation, toolbar, footer, children, host = webPresentation }: {
  navigation: (layout: UiLayoutProfile) => ReactNode;
  toolbar: ReactNode;
  footer: ReactNode;
  children: ReactNode;
  host?: UiPresentationHost<WebShellRenderer>;
}) {
  const restore = useRef<{ focus: HTMLElement | null; x: number; y: number } | undefined>(undefined);
  const snapshot = useSyncExternalStore(listener => host.subscribe(() => {
    restore.current = { focus: document.activeElement as HTMLElement | null, x: window.scrollX, y: window.scrollY };
    listener();
  }), host.getSnapshot, host.getSnapshot);
  const [container] = useState(() => document.createElement('div'));
  useLayoutEffect(() => {
    const root = document.documentElement;
    const names = Object.keys(snapshot.theme.tokens).map(key => '--mote-' + key);
    for (const [key, value] of Object.entries(snapshot.theme.tokens)) root.style.setProperty('--mote-' + key, value);
    const background=snapshot.theme.tokens.background;
    const channels=[1,3,5].map(index=>Number.parseInt(background.slice(index,index+2),16));
    const previousScheme=root.style.colorScheme;
    root.style.colorScheme=(channels[0]*299+channels[1]*587+channels[2]*114)/1000<128?'dark':'light';
    root.dataset.uiTheme = snapshot.theme.id;
    root.dataset.uiLayout = snapshot.layout.id;
    const saved = restore.current;
    if (saved) {
      if (saved.focus?.isConnected) saved.focus.focus({ preventScroll: true });
      window.scrollTo(saved.x, saved.y);
      restore.current = undefined;
    }
    return () => { for (const name of names) root.style.removeProperty(name);root.style.colorScheme=previousScheme; };
  }, [snapshot]);
  return <>
    <ShellBoundary key={snapshot.layout.id+'@'+snapshot.layout.version} renderer={snapshot.layout.implementation} slots={{layout:snapshot.layout,navigation:navigation(snapshot.layout),toolbar,footer,content:<ContentOutlet container={container}/>}}/>
    {createPortal(children, container)}
    {snapshot.fallbackReason&&<p role="status" className="notice presentation-notice">{moteText('专用视图暂不可用，请查看资料库或重试。')}</p>}
  </>;
}
