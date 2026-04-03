import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';

// Helper: get user's store_id from auth header
async function getUserStoreId(supabase: Awaited<ReturnType<typeof createServerSupabase>>, req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader) return null;
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  const { data: userData } = await supabase.from('users').select('store_id').eq('id', user.id).single();
  return userData?.store_id || null;
}

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabase();
  const { searchParams } = new URL(req.url);
  const page = Number.parseInt(searchParams.get('page') || '1');
  const limit = Math.min(Number.parseInt(searchParams.get('limit') || '50'), 100);
  const offset = (page - 1) * limit;
  const storeId = searchParams.get('store_id'); // Optional: filter by store

  try {
    let query = supabase
      .from('products')
      .select('*, categories(name)', { count: 'exact' })
      .order('name')
      .range(offset, offset + limit - 1);

    if (storeId) {
      query = query.eq('store_id', storeId);
    }

    const { data, error, count } = await query;

    if (error) throw error;
    const response = NextResponse.json({
      data: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });

    response.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');
    return response;
  } catch (err) {
    console.error('Products API error:', err);
    return NextResponse.json({ error: 'Gagal memuat daftar produk. Silakan refresh halaman.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase();
  try {
    const body = await req.json();
    // Enforce store_id from user's session — don't trust body store_id
    const userStoreId = await getUserStoreId(supabase, req);
    const { store_id: _ignored, ...rest } = body;
    const dataToInsert = { ...rest, store_id: userStoreId || body.store_id || null };

    const { data, error } = await supabase.from('products').insert(dataToInsert).select().single();
    if (error) throw error;
    return NextResponse.json(data);
  } catch (err) {
    console.error('Products POST error:', err);
    return NextResponse.json({ error: 'Gagal menyimpan produk. Silakan coba lagi.' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const supabase = await createServerSupabase();
  try {
    const body = await req.json();
    const { id, ...updates } = body;
    if (!id) return NextResponse.json({ error: 'ID produk diperlukan' }, { status: 400 });

    // Enforce store ownership — verify product belongs to user's store before updating
    const userStoreId = await getUserStoreId(supabase, req);
    const { data: existing } = await supabase.from('products').select('id, store_id').eq('id', id).single();
    if (!existing) return NextResponse.json({ error: 'Produk tidak ditemukan' }, { status: 404 });
    if (userStoreId && existing.store_id && existing.store_id !== userStoreId) {
      return NextResponse.json({ error: 'Tidak diizinkan mengupdate produk store lain' }, { status: 403 });
    }

    const { data, error } = await supabase.from('products').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return NextResponse.json(data);
  } catch (err) {
    console.error('Products PUT error:', err);
    return NextResponse.json({ error: 'Gagal mengupdate produk. Silakan coba lagi.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const supabase = await createServerSupabase();
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID produk diperlukan' }, { status: 400 });

    // Enforce store ownership — verify product belongs to user's store before deleting
    const userStoreId = await getUserStoreId(supabase, req);
    const { data: existing } = await supabase.from('products').select('id, store_id').eq('id', id).single();
    if (!existing) return NextResponse.json({ error: 'Produk tidak ditemukan' }, { status: 404 });
    if (userStoreId && existing.store_id && existing.store_id !== userStoreId) {
      return NextResponse.json({ error: 'Tidak diizinkan menghapus produk store lain' }, { status: 403 });
    }

    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Products DELETE error:', err);
    return NextResponse.json({ error: 'Gagal menghapus produk. Silakan coba lagi.' }, { status: 500 });
  }
}
