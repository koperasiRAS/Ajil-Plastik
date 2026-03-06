'use client';

import { useState, useEffect } from 'react';
import { authFetch } from '@/lib/authFetch';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';
import { Expense } from '@/lib/types';

const EXPENSE_CATEGORIES = ['Belanja Stok', 'Listrik', 'Air', 'Gaji', 'Sewa', 'Transportasi', 'Lainnya'];

export default function ExpensesPage() {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [filterMonth, setFilterMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const res = await authFetch('/api/expenses');
      if (!res.ok) throw new Error('API error');
      const data = await res.json();
      // Filter by month client-side since API returns all
      const [year, month] = filterMonth.split('-').map(Number);
      const filtered = (data || []).filter((e: Expense) => {
        const d = new Date(e.date);
        return d.getFullYear() === year && d.getMonth() === month - 1;
      });
      setExpenses(filtered);
    } catch { setExpenses([]); }
    setLoading(false);
  };

  useEffect(() => { fetchExpenses(); }, [filterMonth]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true); setMessage(null);
    try {
      const { error } = await supabase.from('expenses').insert({
        user_id: user.id, category, amount: Number.parseFloat(amount), description: description || null, date,
      });
      if (error) throw error;
      setMessage({ type: 'success', text: '✓ Pengeluaran berhasil dicatat' });
      setCategory(''); setAmount(''); setDescription(''); setShowForm(false); fetchExpenses();
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Gagal menyimpan' });
    } finally { setSaving(false); }
  };

  const deleteExpense = async (id: string) => {
    if (!confirm('Hapus pengeluaran ini?')) return;
    await supabase.from('expenses').delete().eq('id', id);
    fetchExpenses();
  };

  const formatRupiah = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;
  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0);

  // Group by category
  const byCategory = expenses.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + Number(e.amount);
    return acc;
  }, {} as Record<string, number>);

  // Export CSV
  const exportCSV = () => {
    const headers = ['Tanggal', 'Kategori', 'Jumlah', 'Keterangan'];
    const rows = expenses.map(e => [e.date, e.category, e.amount, e.description || '-']);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `pengeluaran_${filterMonth}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto" style={{ background: 'var(--bg-primary)', minHeight: '100vh' }}>
      <div className="flex items-center justify-between mb-6 animate-fade-in">
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>💸 Pengeluaran</h1>
        <div className="flex gap-2">
          <button onClick={exportCSV} className="px-4 py-2 rounded-lg text-sm transition-all hover:scale-105"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}>📥 Export</button>
          <button onClick={() => setShowForm(true)} className="btn-primary px-4 py-2">+ Tambah</button>
        </div>
      </div>

      {message && <div className={`mb-4 ${message.type === 'success' ? 'alert-success' : 'alert-error'}`}>{message.text}</div>}

      {/* Month Filter */}
      <div className="mb-4 animate-fade-in">
        <input type="month" value={filterMonth} onChange={e => setFilterMonth(e.target.value)} className="input-field w-48" />
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6 stagger-children">
        <div className="stat-card">
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Total Bulan Ini</p>
          <p className="text-xl font-bold mt-1" style={{ color: 'var(--accent-red)' }}>{formatRupiah(totalExpenses)}</p>
        </div>
        {Object.entries(byCategory).slice(0, 3).map(([cat, amt]) => (
          <div key={cat} className="stat-card">
            <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{cat}</p>
            <p className="text-lg font-bold mt-1" style={{ color: 'var(--text-primary)' }}>{formatRupiah(amt)}</p>
          </div>
        ))}
      </div>

      {/* Add Form */}
      {showForm && (
        <div className="glass-card p-5 mb-6 animate-fade-in-scale">
          <h3 className="text-sm font-bold mb-4" style={{ color: 'var(--text-primary)' }}>➕ Catat Pengeluaran</h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
            <div><label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Kategori</label>
              <select value={category} onChange={e => setCategory(e.target.value)} required className="input-field">
                <option value="">Pilih...</option>
                {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select></div>
            <div><label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Jumlah (Rp)</label>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} required min="0" className="input-field" /></div>
            <div><label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Tanggal</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} required className="input-field" /></div>
            <div><label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Keterangan</label>
              <input type="text" value={description} onChange={e => setDescription(e.target.value)} className="input-field" placeholder="Opsional..." /></div>
            <div className="col-span-2 flex gap-2">
              <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Menyimpan...' : 'Simpan'}</button>
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-sm"
                style={{ background: 'var(--bg-input)', color: 'var(--text-secondary)' }}>Batal</button>
            </div>
          </form>
        </div>
      )}

      {/* Expenses Table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--accent-blue)', borderTopColor: 'transparent' }} />
        </div>
      ) : (
        <div className="glass-card overflow-hidden animate-fade-in">
          <table className="data-table">
            <thead><tr><th>Tanggal</th><th>Kategori</th><th className="text-right">Jumlah</th><th>Keterangan</th><th className="text-right">Aksi</th></tr></thead>
            <tbody>
              {expenses.map(exp => (
                <tr key={exp.id}>
                  <td className="text-xs" style={{ color: 'var(--text-muted)' }}>{new Date(exp.date).toLocaleDateString('id-ID')}</td>
                  <td><span className="badge badge-purple">{exp.category}</span></td>
                  <td className="text-right font-medium" style={{ color: 'var(--accent-red)' }}>{formatRupiah(exp.amount)}</td>
                  <td className="text-xs" style={{ color: 'var(--text-muted)' }}>{exp.description || '-'}</td>
                  <td className="text-right">
                    <button onClick={() => deleteExpense(exp.id)} className="text-xs transition-all hover:scale-110" style={{ color: 'var(--accent-red)' }}>Hapus</button>
                  </td>
                </tr>
              ))}
              {expenses.length === 0 && <tr><td colSpan={5} className="text-center py-8" style={{ color: 'var(--text-muted)' }}>Belum ada pengeluaran</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
