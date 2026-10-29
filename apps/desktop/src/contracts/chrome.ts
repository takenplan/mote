/** A recent read-only query of the exact saved origins; never a grant or capture lease. */
export type ChromePermissionStatus =
  | {state:'checked';checkedAt:string;origins:{origin:string;allowed:boolean}[]}
  | {state:'disconnected'|'ambiguous'|'busy'|'unavailable'|'stale'|'canceled';origins:[]};
