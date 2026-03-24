import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabase();
  const { searchParams } = new URL(request.url);
  const storeId = searchParams.get('store_id'); // Optional: filter by store

  try {
    let query = supabase
      .from('shifts')
      .select('*, users(name)')
      .order('opened_at', { ascending: false })
      .limit(50);

    // Filter by store if provided
    if (storeId) {
      query = query.eq('store_id', storeId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (err) {
    console.error('Shifts API error:', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
