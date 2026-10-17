import {createBrowserAppearance} from '@mote/shared';
export const webAppearance=createBrowserAppearance(typeof window==='undefined'?undefined:window);
