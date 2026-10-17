import {AppearanceStore} from '@mote/shared';
const initial=window.mote.initialAppearance;
export const desktopAppearance=new AppearanceStore(initial.preference,initial.scheme==='dark');
export function receiveAppearance(value:typeof initial){desktopAppearance.systemChanged(value.scheme==='dark');desktopAppearance.select(value.preference);}
window.mote.onAppearance(receiveAppearance);
