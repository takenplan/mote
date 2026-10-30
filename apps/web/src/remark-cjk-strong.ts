import {attention} from 'micromark-core-commonmark';

const cjk=/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;
const punctuation=/\p{Punctuation}/u;
function cjkCharacter(code:number|null){return code!==null&&code>=0&&cjk.test(String.fromCodePoint(code));}
function cjkPunctuation(code:number|null){
 return code!==null&&([0x2018,0x2019,0x201c,0x201d].includes(code)||(code>=0x3001&&code<=0x303f)||(code>=0xfe10&&code<=0xfe1f)||(code>=0xfe30&&code<=0xfe4f)||(code>=0xff00&&code<=0xffef))&&punctuation.test(String.fromCodePoint(code));
}
/** Keep CommonMark's tokenization/resolution. Relax only the exact double-star
 * flanking boundary between a CJK letter and CJK punctuation. Code, escapes,
 * destinations, HTML and unmatched delimiters retain their parser constructs. */
const tokenize:NonNullable<typeof attention.tokenize>=function(effects,ok,nok){
 const context=this,previous=this.previous;let sequence:ReturnType<typeof effects.exit>|undefined;
 return attention.tokenize!.call(this,{...effects,exit(type){const token=effects.exit(type);if(token.type==='attentionSequence')sequence=token;return token;}},code=>{
  if(sequence&&sequence.end.offset-sequence.start.offset===2&&context.sliceSerialize(sequence)==='**'){
   if(cjkPunctuation(previous)&&cjkCharacter(code))sequence._close=true;
   if(cjkCharacter(previous)&&cjkPunctuation(code))sequence._open=true;
  }
  return ok(code);
 },nok);
};
/** Display-only Markdown extension: never changes the stored answer string. */
export function remarkCjkStrong(this:{data():object}){
 const data=this.data(),extension={text:{42:{...attention,tokenize}}};
 if('micromarkExtensions' in data&&Array.isArray(data.micromarkExtensions))data.micromarkExtensions.push(extension);
 else Object.assign(data,{micromarkExtensions:[extension]});
}
