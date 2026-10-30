/** Safe presentation anchors. They describe installed code; they never contain code or URLs. */
export type LibraryTypeDescriptor={id:string;kind:string;schemaVersion:number;label:string;card?:string;detail?:string;panels?:string[];actions?:string[]};
export type LibrarySourceFacet={id:string;label:string;count:number};
export type LibraryCatalogDescriptor={schemaVersion:1;revision:number;types:LibraryTypeDescriptor[]};
/** Owner-facing filters over existing original metadata; matches may overlap. */
export const libraryMaterialTypes=['note','document','image','coding','transcript','email','calendar','reference'] as const;
export type LibraryMaterialType=typeof libraryMaterialTypes[number];
