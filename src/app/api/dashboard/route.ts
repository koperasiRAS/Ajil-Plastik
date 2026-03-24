import { NextRequest, NextResponse } from 'next/server';
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

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabase();
  const { searchParams } = new URL(request.url);
  const shiftId = searchParams.get('shift_id'); // Optional: filter by specific shift
  const storeId = searchParams.get('store_id'); // Optional: filter by store/branch

  try {
    const { todayStartUTC } = getWIBToday();
    const todayISO = todayStartUTC.toISOString();
    const sevenDaysAgo = new Date(todayStartUTC.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Build store filter
    const storeFilter = storeId ? { store_id: storeId } : {};

    // Determine transaction filter based on shift_id or store_id
    // If shift_id provided, filter by that shift; otherwise use today's date + store
    // IMPORTANT: Add limit to prevent fetching too much data
    let txnQuery = supabase.from('transactions').select('total, payment_method').limit(1000);
    let recentQuery = supabase.from('transactions').select('id, total, created_at, payment_method, users(name)').order('created_at', { ascending: false }).limit(5);

    if (shiftId) {
      txnQuery = txnQuery.eq('shift_id', shiftId);
      recentQuery = recentQuery.eq('shift_id', shiftId);
    } else {
      txnQuery = txnQuery.gte('created_at', todayISO);
      recentQuery = recentQuery.gte('created_at', todayISO);
    }

    // Apply store filter to transactions
    if (Object.keys(storeFilter).length > 0) {
      txnQuery = txnQuery.match(storeFilter);
      recentQuery = recentQuery.match(storeFilter);
    }

    // For COGS - filter by shift_id or date AND store
    // IMPORTANT: Add limit to prevent fetching too much data
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let cogsQuery: any = supabase.from('transaction_items').select('quantity, cost_price, transactions!inner(created_at, store_id)').limit(1000);
    if (shiftId) {
      cogsQuery = supabase.from('transaction_items').select('quantity, cost_price, transactions!inner(shift_id, store_id)').eq('transactions.shift_id', shiftId).limit(1000);
    } else {
      cogsQuery = cogsQuery.gte('transactions.created_at', todayISO);
    }
    // Apply store filter to COGS query
    if (storeId) {
      cogsQuery = cogsQuery.eq('transactions.store_id', storeId);
    }

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
      txnQuery,
      // Products filtered by store
      storeId
        ? supabase.from('products').select('id', { count: 'exact', head: true }).eq('store_id', storeId)
        : supabase.from('products').select('id', { count: 'exact', head: true }),
      // Low stock filtered by store
      storeId
        ? supabase.from('products').select('id', { count: 'exact', head: true }).eq('store_id', storeId).lte('stock', 5)
        : supabase.from('products').select('id', { count: 'exact', head: true }).lte('stock', 5),
      recentQuery, // Already has .order().limit(5) from above — no duplicate
      // Expenses filtered by store — select payment_method to split cash vs non-cash
      storeId
        ? supabase.from('expenses').select('amount, payment_method').eq('store_id', storeId).gte('created_at', todayISO)
        : supabase.from('expenses').select('amount, payment_method').gte('created_at', todayISO),
      cogsQuery,
      // Optimized: Only fetch last 500 transaction items for top products (much lighter)
      supabase.from('transaction_items')
        .select('quantity, products(name), transactions!inner(created_at)')
        .gte('transactions.created_at', sevenDaysAgo)
        .limit(500),
      // Get current open shift for cash balance calculation (filtered by store if provided)
      storeId
        ? supabase.from('shifts').select('opening_cash').eq('status', 'open').eq('store_id', storeId).order('opened_at', { ascending: false }).limit(1)
        : supabase.from('shifts').select('opening_cash').eq('status', 'open').order('opened_at', { ascending: false }).limit(1),
    ]);

    // Get opening cash from current shift
    let openingCash = 0;
    if (shiftRes.data && shiftRes.data.length > 0) {
      openingCash = Number(shiftRes.data[0].opening_cash) || 0;
    }

    // Process expenses — split cash vs non-cash to accurately calculate cash balance
    let todayExpenses = 0;
    let todayCashExpenses = 0;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (expensesRes.data || []).forEach((e: any) => {
        const amt = Number(e.amount);
        todayExpenses += amt;
        if (e.payment_method === 'cash') todayCashExpenses += amt;
      });
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

    const response = NextResponse.json({
      todaySales, todayTransactions: todayTxns.length,
      totalProducts: productsRes.count || 0, lowStockCount: lowStockRes.count || 0,
      todayExpenses, todayCashExpenses, todayCOGS, todayGrossProfit, todayNetProfit, grossMargin,
      recentTransactions: recentRes.data || [], topProducts, salesByPayment,
      openingCash,
    });

    // Cache for 10s on CDN, allow stale for 30s while revalidating in background
    response.headers.set('Cache-Control', 'public, s-maxage=10, stale-while-revalidate=30');

    return response;
  } catch (err) {
    console.error('Dashboard API error:', err);
    return NextResponse.json({ error: 'Gagal memuat data dashboard. Silakan refresh halaman.' }, { status: 500 });
  }
}
