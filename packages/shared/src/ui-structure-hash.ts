/** Browser-safe SHA-256 for structural fingerprints; never used as an authorization token. */
export function uiStructureHash(value: string): string {
  const bytes = new TextEncoder().encode(value), length = Math.ceil((bytes.length + 9) / 64) * 64;
  const data = new Uint8Array(length); data.set(bytes); data[bytes.length] = 0x80;
  const view = new DataView(data.buffer); view.setUint32(length - 4, bytes.length * 8);
  const primes: number[] = [];
  for (let candidate = 2; primes.length < 64; candidate++) if (!primes.some(p => p * p <= candidate && candidate % p === 0)) primes.push(candidate);
  const fraction = (n: number) => ((n - Math.floor(n)) * 4294967296) >>> 0;
  const k = primes.map(p => fraction(Math.cbrt(p))), h = primes.slice(0, 8).map(p => fraction(Math.sqrt(p)));
  const rotate = (n: number, bits: number) => (n >>> bits) | (n << (32 - bits));
  for (let offset = 0; offset < length; offset += 64) {
    const w = new Uint32Array(64);
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(offset + i * 4);
    for (let i = 16; i < 64; i++) {
      const a = w[i - 15]!, b = w[i - 2]!;
      w[i] = (w[i - 16]! + (rotate(a, 7) ^ rotate(a, 18) ^ (a >>> 3)) + w[i - 7]! + (rotate(b, 17) ^ rotate(b, 19) ^ (b >>> 10))) >>> 0;
    }
    let [a,b,c,d,e,f,g,q] = h as [number,number,number,number,number,number,number,number];
    for (let i = 0; i < 64; i++) {
      const t = (q + (rotate(e,6)^rotate(e,11)^rotate(e,25)) + ((e&f)^(~e&g)) + k[i]! + w[i]!) >>> 0;
      const u = ((rotate(a,2)^rotate(a,13)^rotate(a,22)) + ((a&b)^(a&c)^(b&c))) >>> 0;
      q=g;g=f;f=e;e=(d+t)>>>0;d=c;c=b;b=a;a=(t+u)>>>0;
    }
    for (const [i,n] of [a,b,c,d,e,f,g,q].entries()) h[i] = (h[i]! + n) >>> 0;
  }
  return h.map(n=>n.toString(16).padStart(8,'0')).join('');
}
