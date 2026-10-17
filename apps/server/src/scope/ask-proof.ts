/** Historical turns already contain inherited proof. Repeating the same tuple
 * adds no authority, but recursively copying it makes dialogue grow exponentially.
 * Only complete, byte-identical JSON values coalesce. Different revisions,
 * receipts, source incarnations and read kinds still receive strict validation. */
export function exactProofs<T>(values:readonly T[]):T[]{
 return [...new Map(values.map(value=>[JSON.stringify(value),value])).values()];
}
