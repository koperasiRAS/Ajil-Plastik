import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';

const TABLES = ['transaction_items', 'transactions', 'stock_logs', 'expenses', 'shifts', 'products', 'categories'];

export async function GET() {
  const supabase = await createServerSupabase();
  try {
    const counts: Record<string, number> = {};
    for (const table of TABLES) {
      try {
        const { count } = await supabase.from(table).select('*', { count: 'exact', head: true });
        counts[table] = count || 0;
      } catch {
        counts[table] = 0;
      }
    }
    return NextResponse.json(counts);
  } catch (err) {
    console.error('Settings API error:', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const supabase = await createServerSupabase();
  const { searchParams } = new URL(req.url);
  const table = searchParams.get('table');
  const all = searchParams.get('all');

  try {
    if (all === 'true') {
      // Delete all data except products & categories
      const deleteOrder = ['transaction_items', 'transactions', 'stock_logs', 'expenses', 'shifts'];
      for (const t of deleteOrder) {
        await supabase.from(t).delete().neq('id', '00000000-0000-0000-0000-000000000000');
      }
      return NextResponse.json({ success: true, message: 'All data deleted (products & categories kept)' });
    }

    if (!table || !TABLES.includes(table)) {
      return NextResponse.json({ error: 'Invalid table' }, { status: 400 });
    }

    // Handle foreign key dependencies
    if (table === 'transactions') {
      await supabase.from('transaction_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    }
    if (table === 'products') {
      await supabase.from('transaction_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('stock_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    }

    const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Settings DELETE error:', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
