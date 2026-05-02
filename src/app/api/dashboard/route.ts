import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';

// Helper: get WIB (UTC+7) date boundaries
function getWIBToday() {
  const now = new Date();
  const wibOffset = 7 * 60;
  const wibNow = new Date(now.getTime() + wibOffset * 60 * 1000);

  const wibMidnight = new Date(Date.UTC(
    wibNow.getUTCFullYear(),
    wibNow.getUTCMonth(),
    wibNow.getUTCDate(),
    0, 0, 0, 0
  ));
  const todayStartUTC = new Date(wibMidnight.getTime() - wibOffset * 60 * 1000);

  return { todayStartUTC };
}

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabase();
  const { searchParams } = new URL(request.url);
  const storeId = searchParams.get('store_id'); // Optional: filter by store/branch

  try {
    const { todayStartUTC } = getWIBToday();
    const todayISO = todayStartUTC.toISOString();
    const sevenDaysAgo = new Date(todayStartUTC.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Build store filter
    const storeFilter = storeId ? { store_id: storeId } : {};

    // Build base queries - always filter by today's date
    // Fetch transactions with their items to calculate Sales, COGS, and Payment Methods in one pass
    let txnQuery = supabase
      .from('transactions')
      .select('total, payment_method, transaction_items(quantity, cost_price)')
      .gte('created_at', todayISO)
      .limit(1000);
      
    let recentQuery = supabase
      .from('transactions')
      .select('id, total, created_at, payment_method, users(name)')
      .gte('created_at', todayISO)
      .order('created_at', { ascending: false })
      .limit(5);
      
    // Fetch recent transactions for top products (last 7 days)
    // Querying transactions directly is much faster than reverse joining from transaction_items
    let topProductsQuery = supabase
      .from('transactions')
      .select('transaction_items(quantity, products(name))')
      .gte('created_at', sevenDaysAgo)
      .limit(1000);

    // Apply store filter
    if (Object.keys(storeFilter).length > 0) {
      txnQuery = txnQuery.match(storeFilter);
      recentQuery = recentQuery.match(storeFilter);
      topProductsQuery = topProductsQuery.match(storeFilter);
    }

    // ALL queries in parallel for maximum performance!
    const [
      txnRes,
      productsRes,
      lowStockRes,
      recentRes,
      expensesRes,
      topProductsRes,
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
      recentQuery,
      // Expenses - add .limit(1000) to prevent unbounded query
      storeId
        ? supabase.from('expenses').select('amount, payment_method').eq('store_id', storeId).gte('created_at', todayISO).limit(1000)
        : supabase.from('expenses').select('amount, payment_method').gte('created_at', todayISO).limit(1000),
      topProductsQuery,
    ]);

    // Process expenses
    let todayExpenses = 0;
    let todayCashExpenses = 0;
    try {
      (expensesRes.data || []).forEach((e: any) => {
        const amt = Number(e.amount);
        todayExpenses += amt;
        if (e.payment_method === 'cash') todayCashExpenses += amt;
      });
    } catch { /* */ }

    // Process Transactions, Sales, COGS, and Payments in one loop
    const todayTxns = txnRes.data || [];
    let todaySales = 0;
    let todayCOGS = 0;
    const salesByPayment = { cash: 0, qris: 0, transfer: 0 };
    
    todayTxns.forEach((t: any) => {
      const total = Number(t.total);
      todaySales += total;
      
      const method = t.payment_method as keyof typeof salesByPayment;
      if (method in salesByPayment) salesByPayment[method] += total;
      
      // Calculate COGS from nested items
      (t.transaction_items || []).forEach((item: any) => {
        todayCOGS += (Number(item.cost_price || 0) * Number(item.quantity || 0));
      });
    });

    // Process top products from the 7-day transactions query
    const topProducts: { name: string; totalSold: number }[] = [];
    try {
      const productMap = new Map<string, number>();
      (topProductsRes.data || []).forEach((txn: any) => {
        (txn.transaction_items || []).forEach((item: any) => {
           const name = item.products?.name || 'Unknown';
           productMap.set(name, (productMap.get(name) || 0) + Number(item.quantity || 0));
        });
      });
      Array.from(productMap.entries())
        .map(([name, totalSold]) => ({ name, totalSold }))
        .sort((a, b) => b.totalSold - a.totalSold)
        .slice(0, 5)
        .forEach(p => topProducts.push(p));
    } catch { /* */ }

    const todayGrossProfit = todaySales - todayCOGS;
    const todayNetProfit = todayGrossProfit - todayExpenses;
    const grossMargin = todaySales > 0 ? (todayGrossProfit / todaySales) * 100 : 0;

    const response = NextResponse.json({
      todaySales, todayTransactions: todayTxns.length,
      totalProducts: productsRes.count || 0, lowStockCount: lowStockRes.count || 0,
      todayExpenses, todayCashExpenses, todayCOGS, todayGrossProfit, todayNetProfit, grossMargin,
      recentTransactions: recentRes.data || [], topProducts, salesByPayment,
    });

    // Cache for 10s on CDN
    response.headers.set('Cache-Control', 'public, s-maxage=10, stale-while-revalidate=30');

    return response;
  } catch (err) {
    console.error('Dashboard API error:', err);
    return NextResponse.json({ error: 'Gagal memuat data dashboard. Silakan refresh halaman.' }, { status: 500 });
  }
}
