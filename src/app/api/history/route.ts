import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabase();
  const { searchParams } = new URL(req.url);
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const method = searchParams.get('method');
  const storeId = searchParams.get('store_id');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100); // Max 100 per page
  const offset = (page - 1) * limit;

  try {
    let query = supabase
      .from('transactions')
      .select('id, total, created_at, payment_method, discount, users(name), transaction_items(quantity, price, products(name))', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Filter by store if provided
    if (storeId) query = query.eq('store_id', storeId);
    if (from) query = query.gte('created_at', new Date(from).toISOString());
    if (to) {
      const toDate = new Date(to);
      toDate.setHours(23, 59, 59);
      query = query.lte('created_at', toDate.toISOString());
    }
    if (method && method !== 'all') query = query.eq('payment_method', method);

    const { data, error, count } = await query;
    if (error) throw error;

    return NextResponse.json({
      data: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (err) {
    console.error('History API error:', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
