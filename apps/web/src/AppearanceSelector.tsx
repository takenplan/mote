import {useState,useSyncExternalStore} from 'react';
import {moteText} from '@mote/shared/i18n';
import {webAppearance} from './appearance';
export function AppearanceSelector() {
  const {preference}=useSyncExternalStore(webAppearance.subscribe,webAppearance.getSnapshot,webAppearance.getSnapshot);
  const [failed,setFailed]=useState(false);
  return <label className="language-selector">{moteText('外观')}
    <select aria-label={moteText('外观')} value={preference} onChange={event=>setFailed(!webAppearance.save(event.target.value))}>
      <option value="light">{moteText('浅色')}</option><option value="dark">{moteText('深色')}</option><option value="auto">{moteText('跟随系统')}</option>
    </select>{failed&&<span role="status">{moteText('无法保存外观偏好，已跟随系统。')}</span>}
  </label>;
}
