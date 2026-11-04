// Cloudflare Worker endpoint: GET /api/slims-member

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const providedKey = url.searchParams.get('key');
  const expectedKey = env.SLIMS_SECRET || 'slims-secret-key-123';

  if (!providedKey || providedKey !== expectedKey) {
    return new Response(JSON.stringify({ error: 'Akses ditolak: kunci invalid.' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const supabaseUrl = env.SUPABASE_URL;
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return new Response(JSON.stringify({ 
      error: 'Environment SUPABASE_URL atau SUPABASE_SERVICE_ROLE_KEY belum diset di .dev.vars' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    // Ambil seluruh isi tabel murid tanpa filter kolom yang berpotensi error
    const spResponse = await fetch(
      `${supabaseUrl}/rest/v1/murid?select=*`, 
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!spResponse.ok) {
      const errText = await spResponse.text();
      return new Response(JSON.stringify({ error: `Supabase Error (${spResponse.status}): ${errText}` }), {
        status: spResponse.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const rows = await spResponse.json();

    // Mapping fleksibel mencari nama kolom yang tersedia di record Supabase
    const members = rows.map(m => {
      // Cari nama murid
      const name = m.nama_lengkap || m.nama_murid || m.nama || m.full_name || m.name || 'Tanpa Nama';
      
      // Cari ID / NISN
      const memberId = String(m.nisn || m.nis || m.id || '');
      
      // Cari jenis kelamin
      const genderRaw = String(m.jenis_kelamin || m.gender || m.jk || '').toUpperCase();
      const gender = (genderRaw === 'L' || genderRaw === 'MALE' || genderRaw === '1') ? 1 : 0;

      return {
        member_id: memberId,
        member_name: name,
        gender: gender,
        member_type_id: 1,
        inst_name: 'SDS Islam At-Taqwa',
        is_active: 1
      };
    });

    return new Response(JSON.stringify(members), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: 'Exception: ' + (e.message || String(e)) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function onRequest() {
  return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
}