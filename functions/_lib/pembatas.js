// Pembatas percobaan (rate limit) bersama. Dipakai login guru, kode akses orang tua, dan pendaftaran umum.
//
// Dua mode, dipilih otomatis:
//  1) KV (disarankan): bila binding PEMBATAS_KV ada, hitungan disimpan di Cloudflare KV sehingga dibagi
//     ke semua instance Worker dan tidak hilang saat restart. Cara mengaktifkan: lihat README > "Pembatas percobaan".
//  2) Memori (cadangan): bila binding tidak ada, hitungan disimpan di memori instance. Perilaku sama seperti
//     sebelumnya (best-effort, bisa reset kapan saja), jadi tidak ada yang rusak bila KV belum disiapkan.
//
// Catatan: KV bersifat eventually consistent (hitungan bisa terlambat beberapa detik antar lokasi).
// Itu jauh lebih kuat daripada memori per-instance, tetapi bukan penghitung yang presisi.

const memori = new Map();
const kunciKv = k => 'rl:' + k;

async function baca(env, k, jendelaMs, sekarang) {
  let t = null;
  if (env && env.PEMBATAS_KV) {
    try { t = await env.PEMBATAS_KV.get(kunciKv(k), 'json'); } catch (e) { t = null; }
  } else {
    t = memori.get(k) || null;
  }
  return (!t || sekarang - t.start > jendelaMs) ? { n: 0, start: sekarang } : t;
}

async function tulis(env, k, t, jendelaMs, sekarang) {
  if (env && env.PEMBATAS_KV) {
    const sisaDetik = Math.max(60, Math.ceil((t.start + jendelaMs - sekarang) / 1000)); // KV: TTL minimum 60 detik
    try { await env.PEMBATAS_KV.put(kunciKv(k), JSON.stringify(t), { expirationTtl: sisaDetik }); } catch (e) { /* gagal tulis = jangan blokir pengguna */ }
    return;
  }
  memori.set(k, t);
  if (memori.size > 5000) for (const [kk, v] of memori) if (sekarang - v.start > jendelaMs) memori.delete(kk);
}

// Sudah melewati batas? (tidak menambah hitungan)
export async function sudahBatas(env, kunci, maks, jendelaMs = 10 * 60 * 1000) {
  const t = await baca(env, kunci, jendelaMs, Date.now());
  return t.n >= maks;
}
// Catat satu kegagalan.
export async function catatGagal(env, kunci, jendelaMs = 10 * 60 * 1000) {
  const now = Date.now(), t = await baca(env, kunci, jendelaMs, now);
  t.n++; await tulis(env, kunci, t, jendelaMs, now);
  return t.n;
}
// Hapus hitungan (mis. setelah login berhasil).
export async function hapusBatas(env, kunci) {
  if (env && env.PEMBATAS_KV) { try { await env.PEMBATAS_KV.delete(kunciKv(kunci)); } catch (e) {} } else memori.delete(kunci);
}
// Hitung setiap permintaan (bukan hanya kegagalan); true bila sudah melebihi batas. Untuk formulir pendaftaran.
export async function terlaluSering(env, request, nama, maks, jendelaMs = 10 * 60 * 1000) {
  const k = nama + ':' + (request.headers.get('CF-Connecting-IP') || 'unknown');
  return (await catatGagal(env, k, jendelaMs)) > maks;
}
