import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';

// Helper: get WIB (UTC+7) date boundaries
function getWIBToday() {
  const now = new Date();
  // Current time in WIB
  const wibOffset = 7 * 60; // UTC+7 in minutes
  const wibNow = new Date(now.getTime() + wibOffset * 60 * 1000);
  
  // Today start in WIB = midnight WIB = 17:00 UTC previous day
  const wibMidnight = new Date(Date.UTC(
    wibNow.getUTCFullYear(),
    wibNow.getUTCMonth(),
    wibNow.getUTCDate(),
    0, 0, 0, 0
  ));
  // Convert back to UTC: midnight WIB = midnight - 7 hours in UTC
  const todayStartUTC = new Date(wibMidnight.getTime() - wibOffset * 60 * 1000);
  
  // Today's date string in WIB format (YYYY-MM-DD)
  const todayDateWIB = `${wibNow.getUTCFullYear()}-${String(wibNow.getUTCMonth() + 1).padStart(2, '0')}-${String(wibNow.getUTCDate()).padStart(2, '0')}`;
  
  return { todayStartUTC, todayDateWIB };
}

export async function GET() {
  const supabase = await createServerSupabase();

  try {
    const { todayStartUTC } = getWIBToday();
    const todayISO = todayStartUTC.toISOString();
    const sevenDaysAgo = new Date(todayStartUTC.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // ALL queries in parallel for maximum performance!
    const [
      txnRes,
      productsRes,
      lowStockRes,
      recentRes,
      expensesRes,
      cogsRes,
      topProductsRes,
      shiftRes
    ] = await Promise.all([
      supabase.from('transactions').select('total, payment_method').gte('created_at', todayISO),
      supabase.from('products').select('id', { count: 'exact', head: true }),
      supabase.from('products').select('id', { count: 'exact', head: true }).lte('stock', 5),
      supabase.from('transactions').select('id, total, created_at, payment_method, users(name)').order('created_at', { ascending: false }).limit(5),
      // Use created_at instead of date for consistent timezone handling
      supabase.from('expenses').select('amount').gte('created_at', todayISO),
      supabase.from('transaction_items').select('quantity, cost_price, transactions!inner(created_at)').gte('transactions.created_at', todayISO),
      supabase.from('transaction_items').select('quantity, products(name), transactions!inner(created_at)').gte('transactions.created_at', sevenDaysAgo),
      // Get current open shift for cash balance calculation
      supabase.from('shifts').select('opening_cash').eq('status', 'open').order('opened_at', { ascending: false }).limit(1),
    ]);

    // Get opening cash from current shift
    let openingCash = 0;
    if (shiftRes.data && shiftRes.data.length > 0) {
      openingCash = Number(shiftRes.data[0].opening_cash) || 0;
    }

    // Process expenses
    let todayExpenses = 0;
    try {
      todayExpenses = (expensesRes.data || []).reduce((s: number, e: { amount: number }) => s + Number(e.amount), 0);
    } catch { /* */ }

    // Process COGS
    let todayCOGS = 0;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      todayCOGS = (cogsRes.data || []).reduce((sum: number, item: any) => sum + (Number(item.cost_price || 0) * Number(item.quantity)), 0);
    } catch { /* */ }

    // Process top products
    const topProducts: { name: string; totalSold: number }[] = [];
    try {
      const productMap = new Map<string, number>();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (topProductsRes.data || []).forEach((item: any) => {
        const name = item.products?.name || 'Unknown';
        productMap.set(name, (productMap.get(name) || 0) + Number(item.quantity));
      });
      Array.from(productMap.entries())
        .map(([name, totalSold]) => ({ name, totalSold }))
        .sort((a, b) => b.totalSold - a.totalSold)
        .slice(0, 5)
        .forEach(p => topProducts.push(p));
    } catch { /* */ }

    const todayTxns = txnRes.data || [];
    const todaySales = todayTxns.reduce((sum, t) => sum + Number(t.total), 0);
    const todayGrossProfit = todaySales - todayCOGS;
    const todayNetProfit = todayGrossProfit - todayExpenses;
    const grossMargin = todaySales > 0 ? (todayGrossProfit / todaySales) * 100 : 0;

    const salesByPayment = { cash: 0, qris: 0, transfer: 0 };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    todayTxns.forEach((t: any) => {
      const method = t.payment_method as keyof typeof salesByPayment;
      if (method in salesByPayment) salesByPayment[method] += Number(t.total);
    });

    return NextResponse.json({
      todaySales, todayTransactions: todayTxns.length,
      totalProducts: productsRes.count || 0, lowStockCount: lowStockRes.count || 0,
      todayExpenses, todayCOGS, todayGrossProfit, todayNetProfit, grossMargin,
      recentTransactions: recentRes.data || [], topProducts, salesByPayment,
      openingCash,
    });
  } catch (err) {
    console.error('Dashboard API error:', err);
    return NextResponse.json({ error: 'Failed to load dashboard' }, { status: 500 });
  }
}
