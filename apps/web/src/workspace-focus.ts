/** Keep a real focused control and its ring above the fixed mobile navigation. */
export function revealWorkspaceFocus(element: HTMLElement) {
  if (!window.matchMedia('(max-width:760px)').matches) return;
  window.requestAnimationFrame(() => {
    if (document.activeElement !== element || !element.isConnected) return;
    const navigation=document.getElementById('primary-navigation');
    if (!navigation || !navigation.getClientRects().length) return;
    const bottom=navigation.getBoundingClientRect().top;
    const style=getComputedStyle(element),ring=parseFloat(style.outlineWidth)||0,offset=parseFloat(style.outlineOffset)||0;
    const overflow=element.getBoundingClientRect().bottom+ring+Math.max(0,offset)-bottom;
    if (overflow>=0) window.scrollBy({top:Math.ceil(overflow+8),behavior:'instant'});
  });
}
