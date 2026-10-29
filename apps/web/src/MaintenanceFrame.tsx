import type {ReactNode} from 'react';
import {moteText} from '@mote/shared/i18n';

export function MaintenanceFrame({title,children,className=''}:{title:string;children:ReactNode;className?:string}) {
 return <div className={'owner-maintenance-page '+className}>
  <a className="owner-back" href="#/preferences">← {moteText('设置')}</a>
  <header className="owner-maintenance-heading"><h1>{title}</h1></header>
  {children}
 </div>;
}
