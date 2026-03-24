import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabase();
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
  const offset = (page - 1) * limit;
  const storeId = searchParams.get('store_id'); // Optional: filter by store

  try {
    let query = supabase
      .from('products')
      .select('*, categories(name)', { count: 'exact' })
      .order('name')
      .range(offset, offset + limit - 1);

    // Filter by store if provided
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

    // Cache for 60 seconds on CDN - products don't change that frequently
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
    const { data, error } = await supabase.from('products').insert(body).select().single();
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
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Products DELETE error:', err);
    return NextResponse.json({ error: 'Gagal menghapus produk. Silakan coba lagi.' }, { status: 500 });
  }
}
