import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabase();
  const { searchParams } = new URL(request.url);
  const storeId = searchParams.get('store_id') || null; // null = all stores

  try {
    // ── All dashboard data fetched in a SINGLE parallel RPC call ──────────────
    // Previously this was 6 separate queries fetching full rows into JS for aggregation.
    // Now: 4 RPC calls (one per metric group), all run concurrently via Promise.all.
    // Each RPC aggregates natively in Postgres — no rows transferred, only totals.
    const [
      metricsRes,
      topProductsRes,
      recentTxnsRes,
      inventoryRes,
    ] = await Promise.all([
      // 1. Sales, COGS, payment breakdown, expenses — all aggregated in Postgres
      supabase.rpc('fn_get_dashboard_today_metrics', {
        p_store_id: storeId || null,
      }),
      // 2. Top 5 products by qty sold in the last 7 days
      supabase.rpc('fn_get_top_products', {
        p_store_id: storeId || null,
        p_days: 7,
        p_limit: 5,
      }),
      // 3. 5 most recent transactions with cashier name
      supabase.rpc('fn_get_recent_transactions', {
        p_store_id: storeId || null,
        p_limit: 5,
      }),
      // 4. Total products + low-stock count (single index scan)
      supabase.rpc('fn_get_inventory_counts', {
        p_store_id: storeId || null,
        p_low_stock_threshold: 5,
      }),
    ]);

    // ── Surface any RPC errors immediately (before processing) ────────────────
    if (metricsRes.error)        throw new Error(`metrics RPC: ${metricsRes.error.message}`);
    if (topProductsRes.error)   throw new Error(`top_products RPC: ${topProductsRes.error.message}`);
    if (recentTxnsRes.error)    throw new Error(`recent_txns RPC: ${recentTxnsRes.error.message}`);
    if (inventoryRes.error)     throw new Error(`inventory_counts RPC: ${inventoryRes.error.message}`);

    // ── Unpack metrics (RPC returns array with one row) ───────────────────────
    const m = metricsRes.data?.[0] ?? {};
    const todaySales         = Number(m.today_sales        ?? 0);
    const todayCOGS          = Number(m.today_cogs        ?? 0);
    const todayTxns         = Number(m.today_txn_count   ?? 0);
    const todayExpenses      = Number(m.today_expenses    ?? 0);
    const todayCashExpenses  = Number(m.today_cash_expenses ?? 0);
    const salesByPayment = {
      cash:     Number(m.cash_sales     ?? 0),
      qris:     Number(m.qris_sales     ?? 0),
      transfer: Number(m.transfer_sales ?? 0),
    };

    const todayGrossProfit = todaySales - todayCOGS;
    const todayNetProfit   = todayGrossProfit - todayExpenses;
    const grossMargin      = todaySales > 0 ? (todayGrossProfit / todaySales) * 100 : 0;

    // ── Unpack top products ────────────────────────────────────────────────────
    const topProducts: { name: string; totalSold: number }[] =
      (topProductsRes.data ?? []).map((r: any) => ({
        name:      r.product_name ?? 'Unknown',
        totalSold: Number(r.total_sold ?? 0),
      }));

    // ── Unpack recent transactions ──────────────────────────────────────────────
    const recentTransactions = (recentTxnsRes.data ?? []).map((r: any) => ({
      id:              r.txn_id,
      total:           r.total,
      payment_method:  r.payment_method,
      created_at:      r.created_at,
      users:           { name: r.cashier_name },
    }));

    // ── Unpack inventory counts ────────────────────────────────────────────────
    const inv = inventoryRes.data?.[0] ?? {};
    const totalProducts = Number(inv.total_products  ?? 0);
    const lowStockCount = Number(inv.low_stock_count ?? 0);

    // ── Ship JSON ──────────────────────────────────────────────────────────────
    const response = NextResponse.json({
      todaySales,
      todayTransactions:  todayTxns,
      totalProducts,
      lowStockCount,
      todayExpenses,
      todayCashExpenses,
      todayCOGS,
      todayGrossProfit,
      todayNetProfit,
      grossMargin,
      recentTransactions,
      topProducts,
      salesByPayment,
    });

    // Cache 10s at CDN edge; serve stale for 30s while background revalidation runs
    response.headers.set(
      'Cache-Control',
      'public, s-maxage=10, stale-while-revalidate=30'
    );

    return response;
  } catch (err) {
    console.error('Dashboard API error:', err);
    return NextResponse.json(
      { error: 'Gagal memuat data dashboard. Silakan refresh halaman.' },
      { status: 500 }
    );
  }
}
