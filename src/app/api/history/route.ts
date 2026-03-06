import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabase();
  const { searchParams } = new URL(req.url);
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const method = searchParams.get('method');

  try {
    let query = supabase
      .from('transactions')
      .select('id, total, created_at, payment_method, discount, users(name), transaction_items(quantity, price, products(name))')
      .order('created_at', { ascending: false })
      .limit(100);

    if (from) query = query.gte('created_at', new Date(from).toISOString());
    if (to) {
      const toDate = new Date(to);
      toDate.setHours(23, 59, 59);
      query = query.lte('created_at', toDate.toISOString());
    }
    if (method && method !== 'all') query = query.eq('payment_method', method);

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (err) {
    console.error('History API error:', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
