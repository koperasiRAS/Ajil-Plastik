import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';

// Helper: get WIB (UTC+7) month boundaries
function getWIBMonthRange(monthStr: string) {
  const [year, mon] = monthStr.split('-').map(Number);
  const wibOffset = 7 * 60; // UTC+7 in minutes
  
  // First day of month at midnight WIB
  const startWIB = new Date(Date.UTC(year, mon - 1, 1, 0, 0, 0));
  const startUTC = new Date(startWIB.getTime() - wibOffset * 60 * 1000);
  
  // Last day of month at 23:59:59 WIB
  const lastDay = new Date(year, mon, 0).getDate(); // days in month
  const endWIB = new Date(Date.UTC(year, mon - 1, lastDay, 23, 59, 59));
  const endUTC = new Date(endWIB.getTime() - wibOffset * 60 * 1000);
  
  // Date strings in WIB for expenses (stored as date, not timestamp)
  const startDateWIB = `${year}-${String(mon).padStart(2, '0')}-01`;
  const endDateWIB = `${year}-${String(mon).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  
  return { startUTC, endUTC, startDateWIB, endDateWIB };
}

// Helper: get current month in WIB
function getCurrentMonthWIB(): string {
  const now = new Date();
  const wibOffset = 7 * 60;
  const wibNow = new Date(now.getTime() + wibOffset * 60 * 1000);
  return `${wibNow.getUTCFullYear()}-${String(wibNow.getUTCMonth() + 1).padStart(2, '0')}`;
}

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabase();
  const { searchParams } = new URL(req.url);
  const month = searchParams.get('month') || getCurrentMonthWIB();
  const storeId = searchParams.get('store_id'); // Optional: filter by store

  try {
    const { startUTC, endUTC, startDateWIB, endDateWIB } = getWIBMonthRange(month);

    // Build store filter
    const storeFilter = storeId ? { store_id: storeId } : {};

    // Transactions
    const { data: txns } = await supabase
      .from('transactions')
      .select('total, created_at, payment_method')
      .match(storeFilter)
      .gte('created_at', startUTC.toISOString())
      .lte('created_at', endUTC.toISOString());

    // Transaction items with COGS
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let txnItems: any[] = [];
    try {
      const { data } = await supabase
        .from('transaction_items')
        .select('quantity, price, cost_price, transactions!inner(created_at)')
        .gte('transactions.created_at', startUTC.toISOString())
        .lte('transactions.created_at', endUTC.toISOString());
      txnItems = data || [];
    } catch { /* */ }

    // Expenses (stored as date string, use WIB dates)
    let exps: { amount: number; date: string; category: string }[] = [];
    try {
      const { data } = await supabase
        .from('expenses')
        .select('amount, date, category')
        .match(storeFilter)
        .gte('date', startDateWIB)
        .lte('date', endDateWIB);
      exps = data || [];
    } catch { /* */ }

    return NextResponse.json({ transactions: txns || [], txnItems, expenses: exps });
  } catch (err) {
    console.error('Reports API error:', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
