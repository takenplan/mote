import {FeatureRegistry} from './feature-packs.js';
import {linearThemeTokens} from './ui-theme.generated.js';

/** Presentation identities describe explicit owner-selected UI, never captured content. */
export type UiDestination='library'|'ask'|'sources'|'activity';
export type UiReference={id:string;version:string};
export type UiThemePack=UiReference & {tokens:Readonly<Record<string,string>>};
export type UiLayoutProfile=UiReference & {
  primary:readonly UiDestination[];
  initial:UiDestination;
  navigation:'sidebar'|'top'|'bottom'|'adaptive';
  detail:'split'|'stack';
};
export type UiLayoutPack<T>=UiLayoutProfile & {implementation:T};
export type UiPresentationSnapshot<T>={theme:UiThemePack;layout:UiLayoutPack<T>;fallbackReason?:'theme_removed'|'layout_removed'};
export const linearUiTheme:UiThemePack=Object.freeze({id:'mote.linear',version:'1',tokens:Object.freeze({...linearThemeTokens})});
export const defaultUiLayout:UiLayoutProfile=Object.freeze({id:'mote.workspace',version:'1',primary:Object.freeze(['library','ask','sources','activity'] as UiDestination[]),initial:'library',navigation:'adaptive',detail:'split'});

function reference(value:UiReference){if(!/^[a-z][a-z0-9.-]*$/.test(value.id)||!/^\d+(?:\.\d+)*$/.test(value.version))throw Error('Invalid presentation identity');return value.id+'@'+value.version;}
/** Theme data is role values only, never a stylesheet, resource loader or executable UI. */
export function validateUiTheme(pack:UiThemePack):UiThemePack {
  reference(pack);
  const expected=Object.keys(linearThemeTokens).sort(),keys=Object.keys(pack.tokens).sort();
  if(JSON.stringify(expected)!==JSON.stringify(keys))throw Error('Incompatible theme roles');
  for(const [key,value] of Object.entries(pack.tokens)){
    if(typeof value!=='string'||!value.trim()||/[;{}<>\\]|url\s*\(|@import|expression\s*\(/i.test(value))throw Error('Invalid theme role: '+key);
    const base=linearThemeTokens[key as keyof typeof linearThemeTokens];
    if(base.startsWith('#')&&!/^#[\da-f]{6}(?:[\da-f]{2})?$/i.test(value))throw Error('Invalid theme color: '+key);
    if(/^\d+px$/.test(base)&&!/^\d+(?:\.\d+)?px$/.test(value))throw Error('Invalid theme dimension: '+key);
    if(/^\d+(?:\.\d+)?$/.test(base)&&!/^\d+(?:\.\d+)?$/.test(value))throw Error('Invalid theme number: '+key);
  }
  return Object.freeze({id:pack.id,version:pack.version,tokens:Object.freeze({...pack.tokens})});
}
function layout<T>(pack:UiLayoutPack<T>):UiLayoutPack<T>{
  reference(pack);
  const required=defaultUiLayout.primary;
  if(pack.primary.length!==required.length||new Set(pack.primary).size!==required.length||!required.every(id=>pack.primary.includes(id))||!required.includes(pack.initial)||!['sidebar','top','bottom','adaptive'].includes(pack.navigation)||!['split','stack'].includes(pack.detail)||pack.implementation==null)throw Error('Incompatible layout contract');
  return Object.freeze({...pack,primary:Object.freeze([...pack.primary])});
}

/** Trusted platform implementations stay local; only metadata and role values are portable.
 * The host owns data, commands, drafts and navigation. Activating a pack changes presentation only. */
export class UiPresentationHost<T> {
  private readonly registry=new FeatureRegistry<UiThemePack|UiLayoutPack<T>>();
  private readonly listeners=new Set<()=>void>();
  private readonly defaults:{theme:UiThemePack;layout:UiLayoutPack<T>};
  private snapshot:UiPresentationSnapshot<T>;
  private notificationErrors:readonly unknown[]=[];
  constructor(defaults:{theme:UiThemePack;layout:UiLayoutPack<T>}){
    this.defaults={theme:validateUiTheme(defaults.theme),layout:layout(defaults.layout)};
    this.snapshot=Object.freeze({...this.defaults});
    this.register('theme',this.defaults.theme,true);this.register('layout',this.defaults.layout,true);
  }
  getSnapshot=()=>this.snapshot;
  /** Trusted host adapters can report observer failures without splitting the committed binding. */
  getNotificationErrors=()=>this.notificationErrors;
  subscribe=(listener:()=>void)=>{this.listeners.add(listener);return ()=>{this.listeners.delete(listener);};};
  private publish(snapshot:UiPresentationSnapshot<T>){
    this.snapshot=Object.freeze(snapshot);
    const errors:unknown[]=[];
    for(const listener of this.listeners)try{listener();}catch(error){errors.push(error);}
    this.notificationErrors=Object.freeze(errors);
    return this.notificationErrors;
  }
  private register(surface:'theme'|'layout',value:UiThemePack|UiLayoutPack<T>,pinned=false){
    const id=surface+':'+reference(value),featureId='ui.'+surface+'.'+reference(value),descriptor={id,version:value.version,surface};
    const removeFeature=this.registry.install({id:featureId,version:value.version,components:[descriptor]});
    const removeValue=this.registry.register(featureId,descriptor,value);
    let disposed=false;
    return ()=>{
      if(disposed||pinned)return;disposed=true;removeValue();removeFeature();
      if(reference(this.snapshot[surface])===reference(value))this.publish({...this.snapshot,[surface]:this.defaults[surface],fallbackReason:surface==='theme'?'theme_removed':'layout_removed'});
    };
  }
  registerTheme(pack:UiThemePack){return this.register('theme',validateUiTheme(pack));}
  registerLayout(pack:UiLayoutPack<T>){return this.register('layout',layout(pack));}
  activate(binding:{theme:UiReference;layout:UiReference}){
    const theme=this.registry.get('theme:'+reference(binding.theme)) as UiThemePack|undefined;
    const selected=this.registry.get('layout:'+reference(binding.layout)) as UiLayoutPack<T>|undefined;
    if(!theme||!selected)throw Error('Presentation provider unavailable');
    return this.publish({theme,layout:selected});
  }
}
