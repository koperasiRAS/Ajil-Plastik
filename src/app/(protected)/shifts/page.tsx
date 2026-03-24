'use client';

import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';
import { Shift } from '@/lib/types';
import { broadcastCacheReset } from '@/hooks/useCrossTabSync';
import { formatRupiah } from '@/lib/format';

interface ShiftWithUser extends Shift {
  users?: { name: string } | null;
}

interface ShiftSummary {
  totalCash: number;
  totalQris: number;
  totalTransfer: number;
  totalTransactions: number;
  cashExpenses: number;
  expectedClosingCash: number;
}

const VARIANCE_WARN_THRESHOLD = 10_000; // Rp 10.000

export default function ShiftsPage() {
  const { user, role, store } = useAuth();
  const queryClient = useQueryClient();
  const [openingCash, setOpeningCash] = useState('');
  const [closingCash, setClosingCash] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [expandedShift, setExpandedShift] = useState<string | null>(null);

  // ─── Main shift data query ────────────────────────────────────────────────
  const { data: shiftsData, isLoading } = useQuery({
    queryKey: ['shifts', user?.id, role, store?.id],
    queryFn: async () => {
      if (!user) return { active: null, shifts: [] };
      const { data: activeData } = await supabase
        .from('shifts').select('*').eq('user_id', user.id).eq('status', 'open').limit(1).maybeSingle();
      const query = supabase.from('shifts').select('*, users(name)').order('opened_at', { ascending: false }).limit(50);
      if (role === 'employee') query.eq('user_id', user.id);
      const { data } = await query;
      return { active: activeData as Shift | null, shifts: (data || []) as ShiftWithUser[] };
    },
    enabled: !!user,
    staleTime: 30 * 1000,
    placeholderData: (prev) => prev,
  });

  const activeShift = shiftsData?.active || null;
  const shifts = shiftsData?.shifts || [];

  // ─── Live shift summary (real-time while shift is open) ───────────────────
  const { data: liveSummary } = useQuery<ShiftSummary>({
    queryKey: ['shift-summary', activeShift?.id],
    queryFn: async () => {
      if (!activeShift) return {
        totalCash: 0, totalQris: 0, totalTransfer: 0,
        totalTransactions: 0, cashExpenses: 0, expectedClosingCash: 0,
      };

      // Fetch transactions for this shift
      const [txnRes, expenseRes] = await Promise.all([
        supabase.from('transactions').select('total, payment_method').eq('shift_id', activeShift.id),
        supabase.from('expenses').select('amount').eq('payment_method', 'cash')
          .gte('created_at', activeShift.opened_at),
      ]);

      const txns = txnRes.data || [];
      const cashTxns = txns.filter(t => t.payment_method === 'cash');
      const qrisTxns = txns.filter(t => t.payment_method === 'qris');
      const transferTxns = txns.filter(t => t.payment_method === 'transfer');

      const totalCash = cashTxns.reduce((s, t) => s + Number(t.total), 0);
      const totalQris = qrisTxns.reduce((s, t) => s + Number(t.total), 0);
      const totalTransfer = transferTxns.reduce((s, t) => s + Number(t.total), 0);
      const cashExpenses = (expenseRes.data || []).reduce((s, e) => s + Number(e.amount), 0);

      // SOP Formula: Ekspektasi Kas = Kas Awal + Cash Masuk - Cash Keluar
      const expectedClosingCash = Number(activeShift.opening_cash) + totalCash - cashExpenses;

      return {
        totalCash,
        totalQris,
        totalTransfer,
        totalTransactions: txns.length,
        cashExpenses,
        expectedClosingCash,
      };
    },
    enabled: !!activeShift,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000, // Refresh every 60s while shift is open
  });

  // ─── Cash variance calculation (real-time as user types closing cash) ──────
  const closingCashNum = Number.parseFloat(closingCash) || 0;
  const variance = liveSummary ? closingCashNum - liveSummary.expectedClosingCash : 0;
  const hasLargeVariance = Math.abs(variance) > VARIANCE_WARN_THRESHOLD;
  const notesRequired = closingCash !== '' && hasLargeVariance;

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['shifts'] });

  // ─── Open shift ──────────────────────────────────────────────────────────
  const openShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true); setMessage(null);
    try {
      const { error } = await supabase.from('shifts').insert({
        user_id: user.id,
        store_id: store?.id || null,
        opening_cash: Number.parseFloat(openingCash) || 0,
        status: 'open',
      });
      if (error) throw error;
      setMessage({ type: 'success', text: '✓ Shift berhasil dibuka!' });
      setOpeningCash('');
      invalidate();
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Gagal membuka shift' });
    } finally { setSaving(false); }
  };

  // ─── Close shift (SOP: save variance + notes + expected) ─────────────────
  const closeShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeShift || !liveSummary) return;
    if (notesRequired && !notes.trim()) {
      setMessage({ type: 'error', text: '⚠️ Wajib isi catatan karena ada selisih kas > Rp 10.000' });
      return;
    }
    setSaving(true); setMessage(null);
    try {
      const finalVariance = closingCashNum - liveSummary.expectedClosingCash;
      const { error } = await supabase.from('shifts').update({
        closing_cash: closingCashNum,
        closed_at: new Date().toISOString(),
        status: 'closed',
        notes: notes.trim() || null,
        expected_closing_cash: liveSummary.expectedClosingCash,
        cash_variance: finalVariance,
      }).eq('id', activeShift.id);
      if (error) throw error;
      setMessage({ type: 'success', text: `✓ Shift ditutup. Selisih kas: ${finalVariance >= 0 ? '+' : ''}${formatRupiah(finalVariance)}` });
      setClosingCash(''); setNotes('');
      invalidate();
      queryClient.clear();
      broadcastCacheReset();
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Gagal menutup shift' });
    } finally { setSaving(false); }
  };

  const getVarianceColor = (v: number) => {
    if (v === 0) return 'var(--accent-green)';
    return Math.abs(v) > VARIANCE_WARN_THRESHOLD ? 'var(--accent-red)' : 'var(--accent-yellow, #f59e0b)';
  };

  const getVarianceLabel = (v: number) => {
    if (v === 0) return '✅ Pas';
    if (v > 0) return `+${formatRupiah(v)} (lebih)`;
    return `${formatRupiah(v)} (kurang)`;
  };

  if (isLoading) {
    return (
      <div className="p-6 flex justify-center py-12" style={{ background: 'var(--bg-primary)' }}>
        <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--accent-blue)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto" style={{ background: 'var(--bg-primary)', minHeight: '100vh' }}>
      <h1 className="text-xl font-bold mb-6 animate-fade-in" style={{ color: 'var(--text-primary)' }}>⏰ Manajemen Shift</h1>

      {message && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm animate-fade-in ${message.type === 'success' ? 'alert-success' : 'alert-error'}`}>
          {message.text}
        </div>
      )}

      {/* ─── ACTIVE SHIFT ─────────────────────────────────────────────── */}
      {activeShift ? (
        <div className="space-y-4 mb-8">
          {/* Status banner */}
          <div className="glass-card p-4 animate-fade-in" style={{ borderLeft: '4px solid var(--accent-green)' }}>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2.5 h-2.5 rounded-full animate-pulse" style={{ background: 'var(--accent-green)' }} />
              <span className="text-sm font-bold" style={{ color: 'var(--accent-green)' }}>Shift Sedang Berlangsung</span>
            </div>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Dibuka: {new Date(activeShift.opened_at).toLocaleString('id-ID')} &bull; Kas Awal: <strong>{formatRupiah(activeShift.opening_cash)}</strong>
            </p>
          </div>

          {/* Live summary grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 stagger-children">
            <div className="stat-card">
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>💵 Cash Masuk</p>
              <p className="text-lg font-bold mt-1" style={{ color: 'var(--accent-green)' }}>{formatRupiah(liveSummary?.totalCash ?? 0)}</p>
            </div>
            <div className="stat-card">
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>📱 QRIS + Transfer</p>
              <p className="text-lg font-bold mt-1" style={{ color: 'var(--accent-blue)' }}>{formatRupiah((liveSummary?.totalQris ?? 0) + (liveSummary?.totalTransfer ?? 0))}</p>
            </div>
            <div className="stat-card">
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>💸 Pengeluaran Cash</p>
              <p className="text-lg font-bold mt-1" style={{ color: 'var(--accent-red)' }}>-{formatRupiah(liveSummary?.cashExpenses ?? 0)}</p>
            </div>
            <div className="stat-card" style={{ borderLeft: '3px solid var(--accent-teal)' }}>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>🎯 Ekspektasi Kas</p>
              <p className="text-lg font-bold mt-1" style={{ color: 'var(--accent-teal)' }}>{formatRupiah(liveSummary?.expectedClosingCash ?? activeShift.opening_cash)}</p>
              <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>Kas Awal + Cash - Pengeluaran</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <div className="stat-card text-center">
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>🧾 Total Transaksi</p>
              <p className="text-2xl font-bold mt-1" style={{ color: 'var(--text-primary)' }}>{liveSummary?.totalTransactions ?? 0}</p>
            </div>
            <div className="stat-card text-center">
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>💰 Total Omzet</p>
              <p className="text-2xl font-bold mt-1" style={{ color: 'var(--accent-green)' }}>
                {formatRupiah((liveSummary?.totalCash ?? 0) + (liveSummary?.totalQris ?? 0) + (liveSummary?.totalTransfer ?? 0))}
              </p>
            </div>
          </div>

          {/* Close shift form */}
          <div className="glass-card p-5 animate-fade-in">
            <h3 className="text-sm font-bold mb-4" style={{ color: 'var(--text-primary)' }}>🔒 Tutup Shift</h3>
            <form onSubmit={closeShift} className="space-y-4">
              {/* Kas akhir input */}
              <div>
                <label className="block text-xs mb-1 font-medium" style={{ color: 'var(--text-secondary)' }}>
                  Kas Akhir — Hitung fisik uang di laci (Rp)
                </label>
                <input
                  type="number"
                  value={closingCash}
                  onChange={e => setClosingCash(e.target.value)}
                  required min="0"
                  className="input-field text-lg font-mono"
                  placeholder="0"
                />
              </div>

              {/* Live variance display */}
              {closingCash !== '' && (
                <div className="rounded-lg p-4 animate-fade-in" style={{ background: 'var(--bg-card)', border: `1px solid ${getVarianceColor(variance)}33` }}>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Ekspektasi</p>
                      <p className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>{formatRupiah(liveSummary?.expectedClosingCash ?? 0)}</p>
                    </div>
                    <div>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Kas Akhir Input</p>
                      <p className="text-base font-bold" style={{ color: 'var(--accent-blue)' }}>{formatRupiah(closingCashNum)}</p>
                    </div>
                    <div>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Selisih Kas</p>
                      <p className="text-base font-bold" style={{ color: getVarianceColor(variance) }}>{getVarianceLabel(variance)}</p>
                    </div>
                  </div>
                  {hasLargeVariance && (
                    <div className="mt-3 px-3 py-2 rounded-lg text-xs" style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--accent-red)' }}>
                      ⚠️ Selisih melebihi Rp 10.000 — wajib isi catatan penjelasan di bawah
                    </div>
                  )}
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-xs mb-1 font-medium" style={{ color: 'var(--text-secondary)' }}>
                  Catatan Kasir {notesRequired && <span style={{ color: 'var(--accent-red)' }}>*wajib diisi</span>}
                </label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={2}
                  className="input-field resize-none"
                  placeholder={notesRequired ? 'Jelaskan penyebab selisih kas...' : 'Opsional (catatan penutupan)...'}
                  required={notesRequired}
                />
              </div>

              <button type="submit" disabled={saving} className="btn-danger w-full py-3 font-medium text-sm">
                {saving ? '⏳ Menutup Shift...' : '🔒 Tutup Shift & Simpan Laporan'}
              </button>
            </form>
          </div>
        </div>
      ) : (
        /* ─── OPEN SHIFT FORM ───────────────────────────────────────────── */
        <div className="glass-card p-5 mb-8 animate-fade-in">
          <h3 className="text-sm font-bold mb-1" style={{ color: 'var(--text-primary)' }}>🔓 Buka Shift Baru</h3>
          <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>Hitung uang di laci kasir sebelum mulai berjualan</p>
          <form onSubmit={openShift} className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Kas Awal — Uang tunai di laci (Rp)</label>
              <input
                type="number"
                value={openingCash}
                onChange={e => setOpeningCash(e.target.value)}
                required min="0"
                className="input-field text-lg font-mono"
                placeholder="1.000.000"
              />
            </div>
            <button type="submit" disabled={saving} className="btn-success whitespace-nowrap px-6">
              {saving ? '...' : '🔓 Buka Shift'}
            </button>
          </form>
        </div>
      )}

      {/* ─── SHIFT HISTORY ──────────────────────────────────────────────── */}
      <div className="glass-card overflow-hidden animate-fade-in">
        <div className="px-5 py-3" style={{ borderBottom: '1px solid var(--border-default)' }}>
          <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>📖 Riwayat Shift</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Kasir</th>
                <th>Buka</th>
                <th>Tutup</th>
                <th className="text-right">Kas Awal</th>
                <th className="text-right">Kas Akhir</th>
                <th className="text-right">Selisih</th>
                <th className="text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {shifts.map((shift: ShiftWithUser) => {
                const isExpanded = expandedShift === shift.id;
                const v = shift.cash_variance;
                return (
                  <>
                    <tr
                      key={shift.id}
                      onClick={() => setExpandedShift(isExpanded ? null : shift.id)}
                      className="cursor-pointer hover:opacity-90 transition-opacity"
                    >
                      <td style={{ color: 'var(--text-primary)' }}>{shift.users?.name || '-'}</td>
                      <td className="text-xs" style={{ color: 'var(--text-muted)' }}>{new Date(shift.opened_at).toLocaleString('id-ID')}</td>
                      <td className="text-xs" style={{ color: 'var(--text-muted)' }}>{shift.closed_at ? new Date(shift.closed_at).toLocaleString('id-ID') : '-'}</td>
                      <td className="text-right" style={{ color: 'var(--text-primary)' }}>{formatRupiah(shift.opening_cash)}</td>
                      <td className="text-right" style={{ color: 'var(--text-primary)' }}>{shift.closing_cash !== null ? formatRupiah(shift.closing_cash) : '-'}</td>
                      <td className="text-right font-medium">
                        {shift.status === 'closed' && v !== null ? (
                          <span style={{ color: getVarianceColor(v) }}>
                            {v === 0 ? '✅ Pas' : `${v > 0 ? '+' : ''}${formatRupiah(v)}`}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="text-center">
                        <span className={`badge ${shift.status === 'open' ? 'badge-green' : 'badge-blue'}`}>
                          {shift.status === 'open' ? '🟢 Aktif' : 'Selesai'}
                        </span>
                      </td>
                    </tr>
                    {isExpanded && shift.status === 'closed' && (
                      <tr key={`${shift.id}-detail`}>
                        <td colSpan={7} style={{ background: 'var(--bg-card)', padding: '12px 20px' }}>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                            <div>
                              <p style={{ color: 'var(--text-muted)' }}>Ekspektasi Kas</p>
                              <p className="font-medium mt-0.5" style={{ color: 'var(--text-primary)' }}>
                                {shift.expected_closing_cash !== null ? formatRupiah(shift.expected_closing_cash) : '-'}
                              </p>
                            </div>
                            <div>
                              <p style={{ color: 'var(--text-muted)' }}>Kas Aktual</p>
                              <p className="font-medium mt-0.5" style={{ color: 'var(--text-primary)' }}>
                                {shift.closing_cash !== null ? formatRupiah(shift.closing_cash) : '-'}
                              </p>
                            </div>
                            <div>
                              <p style={{ color: 'var(--text-muted)' }}>Selisih</p>
                              <p className="font-bold mt-0.5" style={{ color: v !== null ? getVarianceColor(v) : 'var(--text-muted)' }}>
                                {v !== null ? getVarianceLabel(v) : '-'}
                              </p>
                            </div>
                            <div>
                              <p style={{ color: 'var(--text-muted)' }}>Catatan</p>
                              <p className="mt-0.5 italic" style={{ color: shift.notes ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                                {shift.notes || 'Tidak ada catatan'}
                              </p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
              {shifts.length === 0 && (
                <tr><td colSpan={7} className="text-center py-8" style={{ color: 'var(--text-muted)' }}>Belum ada riwayat shift</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
