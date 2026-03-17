'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { authFetch } from '@/lib/authFetch';
import { useAuth } from '@/components/AuthProvider';

interface DailyData {
  date: string;
  income: number;
  cogs: number;
  expenses: number;
  grossProfit: number;
  netProfit: number;
  txnCount: number;
}

export default function ReportsPage() {
  const { store } = useAuth();
  const [period, setPeriod] = useState<'daily' | 'monthly'>('daily');
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const { data: reportData, isLoading } = useQuery({
    queryKey: ['reports', month, store?.id],
    queryFn: async () => {
      const params = new URLSearchParams({ month });
      if (store?.id) params.append('store_id', store.id);
      const res = await authFetch(`/api/reports?${params}`);
      if (!res.ok) throw new Error('API error');
      return res.json();
    },
  });

  // Process data with useMemo to avoid recalculation on re-renders
  const { dailyData, summary, paymentBreakdown, expenseBreakdown } = useMemo(() => {
    if (!reportData) return {
      dailyData: [],
      summary: { income: 0, cogs: 0, expenses: 0, grossProfit: 0, netProfit: 0, txnCount: 0, grossMargin: 0, netMargin: 0 },
      paymentBreakdown: { cash: 0, qris: 0, transfer: 0 },
      expenseBreakdown: {} as Record<string, number>,
    };

    const [year, mon] = month.split('-').map(Number);
    const startDate = new Date(year, mon - 1, 1);
    const endDate = new Date(year, mon, 0);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const txnItems: any[] = reportData.txnItems || [];
    const exps: { amount: number; date: string; category: string; payment_method: string }[] = reportData.expenses || [];
    const transactions: { total: number; created_at: string; payment_method: string }[] = reportData.transactions || [];

    // Daily breakdown
    const daysMap: Record<string, DailyData> = {};
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      daysMap[dateStr] = { date: dateStr, income: 0, cogs: 0, expenses: 0, grossProfit: 0, netProfit: 0, txnCount: 0 };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    transactions.forEach((t: any) => {
      const dateStr = new Date(t.created_at).toISOString().split('T')[0];
      if (daysMap[dateStr]) {
        daysMap[dateStr].income += Number(t.total);
        daysMap[dateStr].txnCount += 1;
      }
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    txnItems.forEach((item: any) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const txnDate = (item.transactions as any)?.created_at;
      if (txnDate) {
        const dateStr = new Date(txnDate).toISOString().split('T')[0];
        if (daysMap[dateStr]) {
          daysMap[dateStr].cogs += Number(item.cost_price || 0) * Number(item.quantity);
        }
      }
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    exps.forEach((e: any) => {
      if (daysMap[e.date]) {
        daysMap[e.date].expenses += Number(e.amount);
      }
    });

    Object.values(daysMap).forEach(d => {
      d.grossProfit = d.income - d.cogs;
      d.netProfit = d.grossProfit - d.expenses;
    });

    const days = Object.values(daysMap).sort((a, b) => b.date.localeCompare(a.date));

    // Summary
    const totalIncome = transactions.reduce((s, t) => s + Number(t.total), 0);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const totalCOGS = txnItems.reduce((s: number, item: any) => s + (Number(item.cost_price || 0) * Number(item.quantity)), 0);
    const totalExpenses = exps.reduce((s, e) => s + Number(e.amount), 0);
    // Calculate cash expenses separately for accurate cash balance
    const cashExpenses = exps.filter(e => e.payment_method === 'cash').reduce((s, e) => s + Number(e.amount), 0);
    const totalGrossProfit = totalIncome - totalCOGS;
    const totalNetProfit = totalGrossProfit - totalExpenses;

    // Payment breakdown
    const pBreak = { cash: 0, qris: 0, transfer: 0 };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    transactions.forEach((t: any) => {
      const m = t.payment_method as keyof typeof pBreak;
      if (m in pBreak) pBreak[m] += Number(t.total);
    });

    // Expense breakdown
    const eBreak: Record<string, number> = {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    exps.forEach((e: any) => { eBreak[e.category] = (eBreak[e.category] || 0) + Number(e.amount); });

    return {
      dailyData: days,
      summary: {
        income: totalIncome, cogs: totalCOGS, expenses: totalExpenses, cashExpenses,
        grossProfit: totalGrossProfit, netProfit: totalNetProfit,
        txnCount: transactions.length,
        grossMargin: totalIncome > 0 ? (totalGrossProfit / totalIncome * 100) : 0,
        netMargin: totalIncome > 0 ? (totalNetProfit / totalIncome * 100) : 0,
      },
      paymentBreakdown: pBreak,
      expenseBreakdown: eBreak,
    };
  }, [reportData, month]);

  const formatRupiah = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;

  const exportCSV = () => {
    const headers = ['Tanggal', 'Pemasukan', 'HPP', 'Laba Kotor', 'Pengeluaran', 'Laba Bersih', 'Transaksi'];
    const rows = dailyData.map(d => [d.date, d.income, d.cogs, d.grossProfit, d.expenses, d.netProfit, d.txnCount]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `laporan_${month}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const maxIncome = Math.max(...dailyData.map(d => d.income), 1);

  return (
    <div className="p-6 max-w-6xl mx-auto" style={{ background: 'var(--bg-primary)', minHeight: '100vh' }}>
      <div className="flex items-center justify-between mb-6 animate-fade-in">
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>📊 Laporan Keuangan</h1>
        <div className="flex gap-2">
          <input type="month" value={month} onChange={e => setMonth(e.target.value)} className="input-field" />
          <button onClick={exportCSV} className="px-4 py-2 rounded-lg text-sm transition-all hover:scale-105"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}>📥 Export</button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--accent-blue)', borderTopColor: 'transparent' }} />
        </div>
      ) : (
        <>
          {/* Profit Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4 stagger-children">
            <div className="stat-card">
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>💰 Pemasukan</p>
              <p className="text-2xl font-bold mt-1" style={{ color: 'var(--accent-green)' }}>{formatRupiah(summary.income)}</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{summary.txnCount} transaksi</p>
            </div>
            <div className="stat-card">
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>📦 HPP (Harga Pokok)</p>
              <p className="text-2xl font-bold mt-1" style={{ color: 'var(--text-primary)' }}>{formatRupiah(summary.cogs)}</p>
            </div>
            <div className="stat-card">
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>💸 Pengeluaran</p>
              <p className="text-2xl font-bold mt-1" style={{ color: 'var(--accent-red)' }}>{formatRupiah(summary.expenses)}</p>
            </div>
            <div className="stat-card">
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>📊 Margin Kotor</p>
              <p className="text-2xl font-bold mt-1" style={{ color: 'var(--accent-blue)' }}>{summary.grossMargin.toFixed(1)}%</p>
            </div>
          </div>

          {/* Profit Cards */}
          <div className="grid grid-cols-2 gap-4 mb-6 stagger-children">
            <div className="stat-card" style={{ borderLeft: '3px solid var(--accent-green)' }}>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>📈 Laba Kotor (Pemasukan - HPP)</p>
              <p className="text-2xl font-bold mt-1" style={{ color: summary.grossProfit >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                {formatRupiah(summary.grossProfit)}
              </p>
            </div>
            <div className="stat-card" style={{ borderLeft: '3px solid var(--accent-blue)' }}>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>💎 Laba Bersih (Laba Kotor - Pengeluaran)</p>
              <p className="text-2xl font-bold mt-1" style={{ color: summary.netProfit >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                {formatRupiah(summary.netProfit)}
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Margin bersih: {summary.netMargin.toFixed(1)}%</p>
            </div>
          </div>

          {/* Saldo Kas & Bank */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6 stagger-children">
            <div className="stat-card" style={{ borderLeft: '3px solid var(--accent-green)' }}>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>💵 Saldo Kas (Cash)</p>
              <p className="text-2xl font-bold mt-1" style={{ color: (paymentBreakdown.cash - (summary.cashExpenses || 0)) >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                {formatRupiah(paymentBreakdown.cash - (summary.cashExpenses || 0))}
              </p>
              <div className="flex gap-3 mt-1">
                <span className="text-[10px]" style={{ color: 'var(--accent-green)' }}>💰 Masuk: {formatRupiah(paymentBreakdown.cash)}</span>
                <span className="text-[10px]" style={{ color: 'var(--accent-red)' }}>💸 Keluar: {formatRupiah(summary.cashExpenses || 0)}</span>
              </div>
              <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>Pemasukan cash − Pengeluaran cash saja</p>
            </div>
            <div className="stat-card" style={{ borderLeft: '3px solid var(--accent-blue)' }}>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>🏦 Saldo Bank (QRIS + Transfer)</p>
              <p className="text-2xl font-bold mt-1" style={{ color: 'var(--accent-blue)' }}>
                {formatRupiah(paymentBreakdown.qris + paymentBreakdown.transfer)}
              </p>
              <div className="flex gap-3 mt-1">
                <span className="text-[10px]" style={{ color: 'var(--accent-blue)' }}>📱 QRIS: {formatRupiah(paymentBreakdown.qris)}</span>
                <span className="text-[10px]" style={{ color: 'var(--accent-purple)' }}>🏦 Transfer: {formatRupiah(paymentBreakdown.transfer)}</span>
              </div>
              <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>Transfer + QRIS masuk ke rekening bank</p>
            </div>
          </div>

          {/* Breakdowns */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className="glass-card p-5 animate-fade-in">
              <h3 className="text-sm font-bold mb-4" style={{ color: 'var(--text-primary)' }}>💳 Pemasukan per Metode Bayar</h3>
              <div className="space-y-3">
                {[
                  { label: '💵 Cash', value: paymentBreakdown.cash, color: 'var(--accent-green)' },
                  { label: '📱 QRIS', value: paymentBreakdown.qris, color: 'var(--accent-blue)' },
                  { label: '🏦 Transfer', value: paymentBreakdown.transfer, color: 'var(--accent-purple)' },
                ].map(item => (
                  <div key={item.label}>
                    <div className="flex justify-between text-sm mb-1">
                      <span style={{ color: 'var(--text-secondary)' }}>{item.label}</span>
                      <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{formatRupiah(item.value)}</span>
                    </div>
                    <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-input)' }}>
                      <div className="h-full rounded-full transition-all duration-500" style={{
                        width: `${summary.income > 0 ? (item.value / summary.income * 100) : 0}%`,
                        background: item.color,
                      }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-card p-5 animate-fade-in">
              <h3 className="text-sm font-bold mb-4" style={{ color: 'var(--text-primary)' }}>💸 Pengeluaran per Kategori</h3>
              <div className="space-y-3">
                {Object.entries(expenseBreakdown).sort((a, b) => b[1] - a[1]).map(([cat, amount]) => (
                  <div key={cat}>
                    <div className="flex justify-between text-sm mb-1">
                      <span style={{ color: 'var(--text-secondary)' }}>{cat}</span>
                      <span className="font-medium" style={{ color: 'var(--accent-red)' }}>{formatRupiah(amount)}</span>
                    </div>
                    <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-input)' }}>
                      <div className="h-full rounded-full transition-all duration-500" style={{
                        width: `${summary.expenses > 0 ? (amount / summary.expenses * 100) : 0}%`,
                        background: 'var(--accent-red)',
                      }} />
                    </div>
                  </div>
                ))}
                {Object.keys(expenseBreakdown).length === 0 && (
                  <p className="text-sm py-4 text-center" style={{ color: 'var(--text-muted)' }}>Belum ada pengeluaran</p>
                )}
              </div>
            </div>
          </div>

          {/* Bar Chart */}
          <div className="flex gap-1 mb-4 animate-fade-in">
            <button onClick={() => setPeriod('daily')} className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{ background: period === 'daily' ? 'var(--accent-blue)' : 'var(--bg-input)', color: period === 'daily' ? 'white' : 'var(--text-secondary)' }}>
              Harian
            </button>
            <button onClick={() => setPeriod('monthly')} className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{ background: period === 'monthly' ? 'var(--accent-blue)' : 'var(--bg-input)', color: period === 'monthly' ? 'white' : 'var(--text-secondary)' }}>
              Ringkasan
            </button>
          </div>

          {period === 'daily' && (
            <div className="glass-card p-5 animate-fade-in mb-4">
              <h3 className="text-sm font-bold mb-4" style={{ color: 'var(--text-primary)' }}>📅 Pemasukan Harian</h3>
              <div className="flex gap-1 items-end overflow-x-auto" style={{ height: '140px' }}>
                {[...dailyData].reverse().map(day => (
                  <div key={day.date} className="flex flex-col items-center shrink-0 group" style={{ width: '24px' }}>
                    <div className="relative w-full flex flex-col justify-end" style={{ height: '120px' }}>
                      <div className="w-full rounded-t transition-all duration-300 group-hover:opacity-80"
                        style={{
                          height: `${Math.max((day.income / maxIncome) * 100, 2)}%`,
                          background: day.income > 0 ? 'var(--accent-blue)' : 'var(--bg-input)',
                          minHeight: '2px',
                        }}
                      />
                      <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10 whitespace-nowrap px-2 py-1 rounded text-[9px]"
                        style={{ background: 'var(--bg-elevated)', boxShadow: 'var(--shadow-md)', color: 'var(--text-primary)' }}>
                        {formatRupiah(day.income)}
                      </div>
                    </div>
                    <span className="text-[8px] mt-1" style={{ color: 'var(--text-muted)' }}>{new Date(day.date).getDate()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Daily Table */}
          {period === 'daily' && (
            <div className="glass-card overflow-hidden animate-fade-in">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Tanggal</th>
                    <th className="text-right">Pemasukan</th>
                    <th className="text-right">HPP</th>
                    <th className="text-right">Laba Kotor</th>
                    <th className="text-right">Pengeluaran</th>
                    <th className="text-right">Laba Bersih</th>
                    <th className="text-right">Trx</th>
                  </tr>
                </thead>
                <tbody>
                  {dailyData.filter(d => d.income > 0 || d.expenses > 0).map(day => (
                    <tr key={day.date}>
                      <td className="text-sm" style={{ color: 'var(--text-primary)' }}>
                        {new Date(day.date).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })}
                      </td>
                      <td className="text-right" style={{ color: 'var(--accent-green)' }}>{formatRupiah(day.income)}</td>
                      <td className="text-right text-xs" style={{ color: 'var(--text-muted)' }}>{formatRupiah(day.cogs)}</td>
                      <td className="text-right font-medium" style={{ color: day.grossProfit >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                        {formatRupiah(day.grossProfit)}
                      </td>
                      <td className="text-right" style={{ color: 'var(--accent-red)' }}>{formatRupiah(day.expenses)}</td>
                      <td className="text-right font-bold" style={{ color: day.netProfit >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                        {formatRupiah(day.netProfit)}
                      </td>
                      <td className="text-right" style={{ color: 'var(--text-muted)' }}>{day.txnCount}</td>
                    </tr>
                  ))}
                  {dailyData.filter(d => d.income > 0 || d.expenses > 0).length === 0 && (
                    <tr><td colSpan={7} className="text-center py-8" style={{ color: 'var(--text-muted)' }}>Belum ada data</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
