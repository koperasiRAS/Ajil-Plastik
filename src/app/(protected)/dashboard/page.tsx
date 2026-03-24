import { createServerSupabase } from '@/lib/supabase-server';
import DashboardClient from './DashboardClient';

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

// Server Component - fetches initial data for faster FCP
export default async function DashboardPage() {
  const supabase = await createServerSupabase();

  try {
    const { todayStartUTC } = getWIBToday();
    const todayISO = todayStartUTC.toISOString();
    const sevenDaysAgo = new Date(todayStartUTC.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Get active shift first (to filter transactions by shift)
    const { data: activeShiftData } = await supabase
      .from('shifts')
      .select('id, opening_cash')
      .eq('status', 'open')
      .order('opened_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const activeShiftId = activeShiftData?.id || null;
    const openingCash = activeShiftData ? Number(activeShiftData.opening_cash) || 0 : 0;

    // Filter transactions by active shift if exists, otherwise by today
    const txnQuery = activeShiftId
      ? supabase.from('transactions').select('total, payment_method').eq('shift_id', activeShiftId)
      : supabase.from('transactions').select('total, payment_method').gte('created_at', todayISO);

    const recentQuery = activeShiftId
      ? supabase.from('transactions').select('id, total, created_at, payment_method, users(name)').eq('shift_id', activeShiftId).order('created_at', { ascending: false }).limit(5)
      : supabase.from('transactions').select('id, total, created_at, payment_method, users(name)').gte('created_at', todayISO).order('created_at', { ascending: false }).limit(5);

    // Fetch all data in parallel on the server
    const [
      txnRes,
      productsRes,
      lowStockRes,
      recentRes,
      expensesRes,
      cogsRes,
      topProductsRes,
    ] = await Promise.all([
      txnQuery,
      supabase.from('products').select('id', { count: 'exact', head: true }),
      supabase.from('products').select('id', { count: 'exact', head: true }).lte('stock', 5),
      recentQuery,
      supabase.from('expenses').select('amount, payment_method').gte('created_at', todayISO),
      // COGS filtered by shift if active
      activeShiftId
        ? supabase.from('transaction_items').select('quantity, cost_price, transactions!inner(shift_id)').eq('transactions.shift_id', activeShiftId)
        : supabase.from('transaction_items').select('quantity, cost_price, transactions!inner(created_at)').gte('transactions.created_at', todayISO),
      supabase.from('transaction_items').select('quantity, products(name), transactions!inner(created_at)').gte('transactions.created_at', sevenDaysAgo),
    ]);

    // Process data
    // openingCash is already fetched above with activeShiftData

    let todayExpenses = 0;
    let todayCashExpenses = 0;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (expensesRes.data || []).forEach((e: any) => {
        const amt = Number(e.amount);
        todayExpenses += amt;
        if (e.payment_method === 'cash') todayCashExpenses += amt;
      });
    } catch { /* empty */ }

    let todayCOGS = 0;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      todayCOGS = (cogsRes.data || []).reduce((sum: number, item: any) => sum + (Number(item.cost_price || 0) * Number(item.quantity)), 0);
    } catch { /* empty */ }

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
    } catch { /* empty */ }

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

    const initialData = {
      todaySales,
      todayTransactions: todayTxns.length,
      totalProducts: productsRes.count || 0,
      lowStockCount: lowStockRes.count || 0,
      todayExpenses,
      todayCashExpenses,
      todayCOGS,
      todayGrossProfit,
      todayNetProfit,
      grossMargin,
      recentTransactions: recentRes.data || [],
      topProducts,
      salesByPayment,
      openingCash,
    };

    return <DashboardClient initialData={initialData} />;
  } catch (err) {
    console.error('Dashboard SSR error:', err);
    // Return client component without initial data on error
    return <DashboardClient />;
  }
}
