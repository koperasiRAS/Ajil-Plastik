import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabase();
  const { searchParams } = new URL(req.url);
  const storeId = searchParams.get('store_id'); // Optional: filter by store

  try {
    let query = supabase
      .from('products')
      .select('id, name, stock, barcode, category_id, cost_price, price, categories(name)')
      .order('stock', { ascending: true })
      .limit(1000);

    // Filter by store if provided
    if (storeId) {
      query = query.eq('store_id', storeId);
    }

    const { data, error } = await query;
    if (error) throw error;
    const response = NextResponse.json(data || []);
    // Cache for 60 seconds
    response.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');
    return response;
  } catch (err) {
    console.error('Inventory API error:', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
