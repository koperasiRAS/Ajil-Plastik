import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabase();
  const { searchParams } = new URL(req.url);
  const month = searchParams.get('month') || new Date().toISOString().slice(0, 7);

  try {
    const [year, mon] = month.split('-').map(Number);
    const startDate = new Date(year, mon - 1, 1);
    const endDate = new Date(year, mon, 0);
    const endISO = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 23, 59, 59).toISOString();

    // Transactions
    const { data: txns } = await supabase
      .from('transactions')
      .select('total, created_at, payment_method')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endISO);

    // Transaction items with COGS
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let txnItems: any[] = [];
    try {
      const { data } = await supabase
        .from('transaction_items')
        .select('quantity, price, cost_price, transactions!inner(created_at)')
        .gte('transactions.created_at', startDate.toISOString())
        .lte('transactions.created_at', endISO);
      txnItems = data || [];
    } catch { /* */ }

    // Expenses
    let exps: { amount: number; date: string; category: string }[] = [];
    try {
      const { data } = await supabase
        .from('expenses')
        .select('amount, date, category')
        .gte('date', startDate.toISOString().split('T')[0])
        .lte('date', endDate.toISOString().split('T')[0]);
      exps = data || [];
    } catch { /* */ }

    return NextResponse.json({ transactions: txns || [], txnItems, expenses: exps });
  } catch (err) {
    console.error('Reports API error:', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
