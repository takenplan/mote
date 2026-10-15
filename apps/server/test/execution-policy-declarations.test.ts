import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import ts from 'typescript';

test('Central handlers and replayable child definitions explicitly select their task policy',()=>{
 const directory=fileURLToPath(new URL('../src/',import.meta.url)),missing:string[]=[];
 for(const relative of readdirSync(directory,{recursive:true}).filter(path=>String(path).endsWith('.ts'))){
  const path=join(directory,String(relative)),source=ts.createSourceFile(path,readFileSync(path,'utf8'),ts.ScriptTarget.Latest,true);
  const visit=(node:ts.Node)=>{
   if(ts.isCallExpression(node)&&ts.isPropertyAccessExpression(node.expression)&&['register','runStep'].includes(node.expression.name.text)){
    const definition=node.arguments[0];
    if(definition&&ts.isObjectLiteralExpression(definition)){
     const properties=definition.properties.map(property=>property.name?.getText(source));
     if(properties.includes('pool')&&properties.includes('execute')&&!properties.includes('policy'))missing.push(String(relative)+':'+(source.getLineAndCharacterOfPosition(definition.pos).line+1));
    }
   }
   ts.forEachChild(node,visit);
  };
  visit(source);
 }
 assert.deepEqual(missing,[],'Production work must not inherit an unrelated default task deadline or retry budget');
});
