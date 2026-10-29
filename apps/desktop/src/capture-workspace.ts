import {moteText} from '@mote/shared/i18n';
/** Keeps actual controls and their form/listener ownership, with the accepted compact capture hierarchy. */
export function mountCaptureWorkspace(root:Document=document):void {
  const id=(name:string)=>root.getElementById(name)!;
  const screen=root.querySelector<HTMLElement>('[data-page="screen"]')!;screen.querySelector('[data-page-title]')!.textContent=moteText('屏幕记录');screen.classList.add('capture-workspace');
  const permissionControl=id('permissions');
  const card=screen.querySelector<HTMLElement>('.status-card')!,bar=root.createElement('div'),copy=root.createElement('div'),actions=root.createElement('div');bar.className='capture-state-bar';actions.className='actions';copy.append(screen.querySelector('.status-heading')!,id('message'));actions.append(id('start'),id('stop'));bar.append(copy,actions);
  const more=root.createElement('details'),summary=root.createElement('summary');more.className='disclosure capture-maintenance';summary.textContent=moteText('隐私与过滤');more.append(summary,screen.querySelector('.collection-controls')!,screen.querySelector('.page-footnote')!,card.querySelector('.collection-details')!,id('permission'),id('storage-restart'));card.replaceChildren(bar);
  const scope=id('default-collection').closest('.panel')!,defaultField=id('default-collection').closest('fieldset')!,defaults=root.createElement('details'),defaultSummary=root.createElement('summary'),description=root.createElement('small');defaults.className='capture-default-scope';description.id='capture-default-summary';defaultSummary.append(defaultField.querySelector('legend')!.textContent!,description);defaults.append(defaultSummary,...Array.from(defaultField.children).filter(child=>child.tagName!=='LEGEND'));defaultField.replaceWith(defaults);scope.prepend(defaults);
  const heading=scope.querySelector('.section-title')!;heading.querySelector('h2')!.textContent=moteText('应用规则');heading.querySelector('p')?.remove();heading.append(permissionControl);scope.append(more);
  // The channel context button mounts after bootstrap, next to the page title.
}
