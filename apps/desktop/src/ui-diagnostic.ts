import {moteText} from '@mote/shared/i18n';

/** Original diagnostic bytes remain available only through an explicit disclosure. */
export function appendDiagnostic(root:HTMLElement,diagnostic:string):void{
  if(!diagnostic)return;
  const details=root.ownerDocument.createElement('details'),summary=root.ownerDocument.createElement('summary'),body=root.ownerDocument.createElement('pre');
  details.className='ui-diagnostic';summary.textContent=moteText('技术详情');body.textContent=diagnostic;details.append(summary,body);root.append(details);
}
export function renderReadableFailure(root:HTMLElement,message:string,diagnostic:string):void{
  root.replaceChildren(root.ownerDocument.createTextNode(message));root.hidden=false;root.className='';appendDiagnostic(root,diagnostic);
}
