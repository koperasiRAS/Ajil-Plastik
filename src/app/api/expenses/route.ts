import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabase();
  const { searchParams } = new URL(req.url);
  const month = searchParams.get('month'); // e.g. "2026-03"
  const storeId = searchParams.get('store_id'); // Optional: filter by store

  try {
    let query = supabase
      .from('expenses')
      .select('*')
      .order('date', { ascending: false });

    // Filter by store if provided
    if (storeId) {
      query = query.eq('store_id', storeId);
    }

    // Server-side month filtering
    if (month) {
      const [year, mon] = month.split('-').map(Number);
      const lastDay = new Date(year, mon, 0).getDate();
      const startDate = `${year}-${String(mon).padStart(2, '0')}-01`;
      const endDate = `${year}-${String(mon).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      query = query.gte('date', startDate).lte('date', endDate);
    }

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (err) {
    console.error('Expenses API error:', err);
    return NextResponse.json({ error: 'Gagal memuat data pengeluaran. Silakan refresh halaman.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase();
  try {
    const body = await req.json();
    // Validate required fields
    if (!body.description || !body.amount) {
      return NextResponse.json({ error: 'Deskripsi dan jumlah pengeluaran wajib diisi' }, { status: 400 });
    }
    const { data, error } = await supabase.from('expenses').insert(body).select().single();
    if (error) throw error;
    return NextResponse.json(data);
  } catch (err) {
    console.error('Expenses POST error:', err);
    return NextResponse.json({ error: 'Gagal menyimpan pengeluaran. Silakan coba lagi.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const supabase = await createServerSupabase();
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID pengeluaran diperlukan' }, { status: 400 });
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Expenses DELETE error:', err);
    return NextResponse.json({ error: 'Gagal menghapus pengeluaran. Silakan coba lagi.' }, { status: 500 });
  }
}
