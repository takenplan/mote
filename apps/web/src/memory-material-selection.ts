import {memoryMaterialId} from './memory-source-route';
import type {MemoryRecipeRef} from './memory-recipes';

export type MemoryMaterialSelection={materialId:string;ref:string;revision:string;recipes:MemoryRecipeRef[];status:'ready'|'waiting'|'unavailable';evidenceIds:string[]};
export function memoryMaterialSelectionPath(ref:string|null,recipes:MemoryRecipeRef[]=[]){
 const id=memoryMaterialId(ref);if(!id)return null;
 return '/api/memory/materials/'+encodeURIComponent(id)+'?'+new URLSearchParams({revision:ref!.slice(ref!.lastIndexOf('@')+1),...(recipes.length?{recipes:JSON.stringify(recipes)}:{})});
}
