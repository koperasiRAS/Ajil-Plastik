import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';

export async function GET() {
  const supabase = await createServerSupabase();

  try {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();

    // Core queries
    const [txnRes, productsRes, lowStockRes, recentRes] = await Promise.all([
      supabase.from('transactions').select('total, payment_method').gte('created_at', todayISO),
      supabase.from('products').select('id', { count: 'exact', head: true }),
      supabase.from('products').select('id', { count: 'exact', head: true }).lte('stock', 5),
      supabase.from('transactions').select('id, total, created_at, payment_method, users(name)').order('created_at', { ascending: false }).limit(5),
    ]);

    // Expenses
    let todayExpenses = 0;
    try {
      const { data } = await supabase.from('expenses').select('amount').gte('date', today.toISOString().split('T')[0]);
      todayExpenses = (data || []).reduce((s: number, e: { amount: number }) => s + Number(e.amount), 0);
    } catch { /* */ }

    // COGS
    let todayCOGS = 0;
    try {
      const { data } = await supabase
        .from('transaction_items')
        .select('quantity, cost_price, transactions!inner(created_at)')
        .gte('transactions.created_at', todayISO);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      todayCOGS = (data || []).reduce((sum: number, item: any) => sum + (Number(item.cost_price || 0) * Number(item.quantity)), 0);
    } catch { /* */ }

    // Top products (7 days)
    const topProducts: { name: string; totalSold: number }[] = [];
    try {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from('transaction_items')
        .select('quantity, products(name), transactions!inner(created_at)')
        .gte('transactions.created_at', sevenDaysAgo);

      const productMap = new Map<string, number>();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (data || []).forEach((item: any) => {
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
    });
  } catch (err) {
    console.error('Dashboard API error:', err);
    return NextResponse.json({ error: 'Failed to load dashboard' }, { status: 500 });
  }
}
