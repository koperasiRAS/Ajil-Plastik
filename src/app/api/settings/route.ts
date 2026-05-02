import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';

const TABLES = ['transaction_items', 'transactions', 'stock_logs', 'expenses', 'products', 'categories'];

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
      // Delete in order: children first, then parents (for foreign key constraints)
      const deleteOrder = ['transaction_items', 'transactions', 'stock_logs', 'expenses'];
      for (const t of deleteOrder) {
        // Use .not('id', 'is', null) to delete ALL rows (reliable method)
        await supabase.from(t).delete().not('id', 'is', null);
      }
      return NextResponse.json({ success: true, message: 'All data deleted (products & categories kept)' });
    }

    if (!table || !TABLES.includes(table)) {
      return NextResponse.json({ error: 'Invalid table' }, { status: 400 });
    }

    // Handle foreign key dependencies — always delete parent (transactions) BEFORE child (transaction_items)
    // This lets the DB's ON DELETE CASCADE handle children automatically (more efficient).
    // Reversed: delete transactions first, then transaction_items as safety cleanup.
    if (table === 'transactions') {
      await supabase.from(table).delete().not('id', 'is', null);
      await supabase.from('transaction_items').delete().not('id', 'is', null);
      return NextResponse.json({ success: true });
    }
    if (table === 'products') {
      await supabase.from(table).delete().not('id', 'is', null);
      // ON DELETE CASCADE handles stock_logs, but delete transaction_items first
      // so there are no orphaned product_id references
      await supabase.from('transaction_items').delete().not('id', 'is', null);
      await supabase.from('stock_logs').delete().not('id', 'is', null);
      return NextResponse.json({ success: true });
    }

    const { error } = await supabase.from(table).delete().not('id', 'is', null);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Settings DELETE error:', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
