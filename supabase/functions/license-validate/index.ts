/**
 * license-validate Edge Function
 * POST { key: string, shop_id: string }
 * Validates the license key server-side (SALT never leaves the server).
 * On success, marks shops.license_status = 'active'.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

// ─── MD5 implementation (pure Deno, no external dep) ─────────────────────────
function md5(input: string): string {
  const message = new TextEncoder().encode(input);
  let [a, b, c, d] = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476];

  const S = [
    7,12,17,22, 7,12,17,22, 7,12,17,22, 7,12,17,22,
    5, 9,14,20, 5, 9,14,20, 5, 9,14,20, 5, 9,14,20,
    4,11,16,23, 4,11,16,23, 4,11,16,23, 4,11,16,23,
    6,10,15,21, 6,10,15,21, 6,10,15,21, 6,10,15,21,
  ];
  const K: number[] = [];
  for (let i = 0; i < 64; i++) K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 0x100000000) >>> 0;

  const padded = new Uint8Array(Math.ceil((message.length + 9) / 64) * 64);
  padded.set(message);
  padded[message.length] = 0x80;
  const bitLen = BigInt(message.length * 8);
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, Number(bitLen & 0xFFFFFFFFn), true);
  view.setUint32(padded.length - 4, Number(bitLen >> 32n),         true);

  for (let chunk = 0; chunk < padded.length; chunk += 64) {
    const M: number[] = [];
    for (let j = 0; j < 16; j++) M[j] = view.getUint32(chunk + j * 4, true);
    let [A, B, C, D] = [a, b, c, d];
    for (let i = 0; i < 64; i++) {
      let F: number, g: number;
      if      (i < 16) { F = (B & C) | (~B & D);  g = i; }
      else if (i < 32) { F = (D & B) | (~D & C);  g = (5 * i + 1) % 16; }
      else if (i < 48) { F = B ^ C ^ D;            g = (3 * i + 5) % 16; }
      else             { F = C ^ (B | ~D);          g = (7 * i)     % 16; }
      F = (F + A + K[i] + M[g]) >>> 0;
      A = D; D = C; C = B;
      B = (B + ((F << S[i]) | (F >>> (32 - S[i])))) >>> 0;
    }
    a = (a + A) >>> 0; b = (b + B) >>> 0; c = (c + C) >>> 0; d = (d + D) >>> 0;
  }

  const result = new DataView(new ArrayBuffer(16));
  [a, b, c, d].forEach((v, i) => result.setUint32(i * 4, v, true));
  return Array.from(new Uint8Array(result.buffer))
    .map(x => x.toString(16).padStart(2, '0')).join('');
}

// ─── License validation ───────────────────────────────────────────────────────
function validateLicenseKey(key: string, salt: string): boolean {
  // Format check: xxxxxxxx-xxxxxxxx-xxxxxxxx (26 chars)
  if (key.length !== 26) return false;
  if (key[8] !== '-' || key[17] !== '-') return false;
  if (!/^[0-9a-f-]+$/.test(key)) return false;

  const raw   = key.replace(/-/g, '');           // 24 hex chars
  const check = md5(raw + salt);                 // 32 hex chars
  return check.startsWith(raw.substring(0, 12)); // first 12 of raw must match start of hash
}

// ─── Handler ─────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { key, shop_id } = await req.json() as { key: string; shop_id: string };

    if (!key || !shop_id) {
      return new Response(JSON.stringify({ error: 'key සහ shop_id අවශ්‍යයි' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const salt = Deno.env.get('LICENSE_SALT') ?? '';
    if (!validateLicenseKey(key.trim().toLowerCase(), salt)) {
      return new Response(JSON.stringify({ error: 'License key වලංගු නොවේ' }), {
        status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Activate license in DB
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { error } = await supabase
      .from('shops')
      .update({
        license_key:          key.trim().toLowerCase(),
        license_status:       'active',
        license_activated_at: new Date().toISOString(),
      })
      .eq('id', shop_id);

    if (error) throw error;

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Server දෝෂය';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
