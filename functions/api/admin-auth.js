// Cloudflare Pages Function: POST /api/admin-auth
// Memeriksa PIN admin dan mengembalikan token bertanda tangan HMAC (berlaku 8 jam).
// Variabel lingkungan: ADMIN_PIN (wajib), ADMIN_SECRET (opsional, teks acak panjang).
import { json, hmac, same } from '../_lib/util.js';

export async function onRequestPost({ request, env }) {
  const pin = String(env.ADMIN_PIN || '').trim();
  if (!pin) return json(500, { error: 'ADMIN_PIN belum diatur di Cloudflare Workers/Pages Environment.' });

  let input = '';
  try { 
    const body = await request.json();
    input = String(body.pin || '').trim(); 
  } catch (e) {}

  if (!input || !(await same(input, pin))) {
    // Memperlambat tebak-tebakan PIN (mitigasi brute-force)
    await new Promise(r => setTimeout(r, 800)); 
    return json(401, { error: 'PIN admin tidak valid.' });
  }

  // Token berlaku 8 jam
  const exp = Date.now() + 8 * 60 * 60 * 1000;
  const secret = String(env.ADMIN_SECRET || pin);
  const signature = await hmac(secret, String(exp));

  return json(200, { token: `${exp}.${signature}` });
}

export const onRequest = () => json(405, { error: 'Metode tidak diizinkan.' });