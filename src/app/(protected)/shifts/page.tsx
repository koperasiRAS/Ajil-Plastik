'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';
import { Shift } from '@/lib/types';
import { broadcastCacheReset } from '@/hooks/useCrossTabSync';

export default function ShiftsPage() {
  const { user, role, store } = useAuth();
  const queryClient = useQueryClient();
  const [openingCash, setOpeningCash] = useState('');
  const [closingCash, setClosingCash] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const { data: shiftsData, isLoading } = useQuery({
    queryKey: ['shifts', user?.id, role],
    queryFn: async () => {
      if (!user) return { active: null, shifts: [] };
      const { data: activeData } = await supabase
        .from('shifts').select('*').eq('user_id', user.id).eq('status', 'open').limit(1).maybeSingle();
      const query = supabase.from('shifts').select('*, users(name)').order('opened_at', { ascending: false }).limit(50);
      if (role === 'employee') query.eq('user_id', user.id);
      const { data } = await query;
      return { active: activeData as Shift | null, shifts: data || [] };
    },
    enabled: !!user,
  });

  const activeShift = shiftsData?.active || null;
  const shifts = shiftsData?.shifts || [];

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['shifts'] });

  const openShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true); setMessage(null);
    try {
      const { error } = await supabase.from('shifts').insert({ user_id: user.id, store_id: store?.id || null, opening_cash: Number.parseFloat(openingCash) || 0, status: 'open' });
      if (error) throw error;
      setMessage({ type: 'success', text: '✓ Shift berhasil dibuka!' });
      setOpeningCash(''); invalidate();
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Gagal membuka shift' });
    } finally { setSaving(false); }
  };

  const closeShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeShift) return;
    setSaving(true); setMessage(null);
    try {
      const { error } = await supabase.from('shifts').update({
        closing_cash: Number.parseFloat(closingCash) || 0, closed_at: new Date().toISOString(), status: 'closed',
      }).eq('id', activeShift.id);
      if (error) throw error;
      setMessage({ type: 'success', text: '✓ Shift berhasil ditutup!' });
      setClosingCash('');
      invalidate();
      // FULL RESET: Clear all cache to ensure fresh data for new shift
      queryClient.clear();
      // Broadcast full reset to other tabs
      broadcastCacheReset();
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Gagal menutup shift' });
    } finally { setSaving(false); }
  };

  const formatRupiah = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;

  if (isLoading) {
    return (
      <div className="p-6 flex justify-center py-12" style={{ background: 'var(--bg-primary)' }}>
        <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--accent-blue)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto" style={{ background: 'var(--bg-primary)', minHeight: '100vh' }}>
      <h1 className="text-xl font-bold mb-6 animate-fade-in" style={{ color: 'var(--text-primary)' }}>⏰ Shift</h1>

      {message && <div className={`mb-4 ${message.type === 'success' ? 'alert-success' : 'alert-error'}`}>{message.text}</div>}

      {activeShift ? (
        <div className="glass-card p-5 mb-6 animate-fade-in-scale" style={{ borderColor: 'rgba(34, 197, 94, 0.3)' }}>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-2.5 h-2.5 rounded-full animate-pulse" style={{ background: 'var(--accent-green)' }} />
            <h3 className="text-sm font-bold" style={{ color: 'var(--accent-green)' }}>Shift Aktif</h3>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="stat-card"><p className="text-xs" style={{ color: 'var(--text-muted)' }}>Dibuka</p>
              <p className="text-sm font-medium mt-1" style={{ color: 'var(--text-primary)' }}>{new Date(activeShift.opened_at).toLocaleString('id-ID')}</p></div>
            <div className="stat-card"><p className="text-xs" style={{ color: 'var(--text-muted)' }}>Kas Awal</p>
              <p className="text-sm font-medium mt-1" style={{ color: 'var(--accent-green)' }}>{formatRupiah(activeShift.opening_cash)}</p></div>
          </div>
          <form onSubmit={closeShift} className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Kas Akhir (Rp)</label>
              <input type="number" value={closingCash} onChange={e => setClosingCash(e.target.value)} required min="0" className="input-field" />
            </div>
            <button type="submit" disabled={saving} className="btn-danger whitespace-nowrap">{saving ? '...' : '🔒 Tutup Shift'}</button>
          </form>
        </div>
      ) : (
        <div className="glass-card p-5 mb-6 animate-fade-in">
          <h3 className="text-sm font-bold mb-4" style={{ color: 'var(--text-primary)' }}>🔓 Buka Shift Baru</h3>
          <form onSubmit={openShift} className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Kas Awal (Rp)</label>
              <input type="number" value={openingCash} onChange={e => setOpeningCash(e.target.value)} required min="0" className="input-field" />
            </div>
            <button type="submit" disabled={saving} className="btn-success whitespace-nowrap">{saving ? '...' : '🔓 Buka Shift'}</button>
          </form>
        </div>
      )}

      {/* Shift History */}
      <div className="glass-card overflow-hidden animate-fade-in">
        <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border-default)' }}>
          <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>📖 Riwayat Shift</h3>
        </div>
        <table className="data-table">
          <thead><tr><th>Kasir</th><th>Buka</th><th>Tutup</th><th className="text-right">Kas Awal</th><th className="text-right">Kas Akhir</th><th className="text-center">Status</th></tr></thead>
          <tbody>
            {shifts.map((shift: any) => (
              <tr key={shift.id}>
                <td style={{ color: 'var(--text-primary)' }}>{shift.users?.name || '-'}</td>
                <td className="text-xs" style={{ color: 'var(--text-muted)' }}>{new Date(shift.opened_at).toLocaleString('id-ID')}</td>
                <td className="text-xs" style={{ color: 'var(--text-muted)' }}>{shift.closed_at ? new Date(shift.closed_at).toLocaleString('id-ID') : '-'}</td>
                <td className="text-right" style={{ color: 'var(--text-primary)' }}>{formatRupiah(shift.opening_cash)}</td>
                <td className="text-right" style={{ color: 'var(--text-primary)' }}>{shift.closing_cash !== null ? formatRupiah(shift.closing_cash) : '-'}</td>
                <td className="text-center"><span className={`badge ${shift.status === 'open' ? 'badge-green' : 'badge-blue'}`}>{shift.status === 'open' ? 'Aktif' : 'Selesai'}</span></td>
              </tr>
            ))}
            {shifts.length === 0 && <tr><td colSpan={6} className="text-center py-8" style={{ color: 'var(--text-muted)' }}>Belum ada riwayat</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
