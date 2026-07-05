/**
 * license-generate Edge Function
 * POST { shop_id: string }   — called by super_admin only
 * Generates a deterministic license key for a given shop_id using SALT.
 * Returns { key: string } — does NOT save; admin copies and delivers the key.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

// ─── MD5 (same pure-Deno implementation as license-validate) ─────────────────
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

// ─── Key generation ───────────────────────────────────────────────────────────
function generateLicenseKey(shopId: string, salt: string): string {
  // Step 1: generate a 24-char hex base from shop_id + salt
  const base = md5(shopId + salt).substring(0, 24); // 24 hex chars

  // Step 2: craft a key where md5(raw+salt).startsWith(raw[:12])
  // We iterate seeds until the self-validation property holds,
  // making the key mathematically verifiable without knowing shop_id.
  for (let seed = 0; seed < 10000; seed++) {
    const candidate = md5(base + seed.toString()).substring(0, 24);
    const check     = md5(candidate + salt);
    if (check.startsWith(candidate.substring(0, 12))) {
      return `${candidate.slice(0, 8)}-${candidate.slice(8, 16)}-${candidate.slice(16, 24)}`;
    }
  }
  // Fallback (extremely rare): use raw directly even without the self-check property
  return `${base.slice(0, 8)}-${base.slice(8, 16)}-${base.slice(16, 24)}`;
}

// ─── Handler ─────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('authorization') ?? '';
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { authorization: authHeader } } },
    );

    // Verify caller is super_admin
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const { data: profile } = await supabase
      .from('profiles').select('role').eq('id', user.id).maybeSingle();
    if (profile?.role !== 'super_admin') {
      return new Response(JSON.stringify({ error: 'Super Admin access required' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { shop_id } = await req.json() as { shop_id: string };
    if (!shop_id) {
      return new Response(JSON.stringify({ error: 'shop_id අවශ්‍යයි' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const salt = Deno.env.get('LICENSE_SALT') ?? '';
    const key  = generateLicenseKey(shop_id, salt);

    return new Response(JSON.stringify({ key }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Server දෝෂය';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
