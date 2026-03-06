'use client';

import { useState, useEffect } from 'react';
import { authFetch } from '@/lib/authFetch';
import { supabase } from '@/lib/supabase';
import { Product, StockLog } from '@/lib/types';

export default function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [stockLogs, setStockLogs] = useState<StockLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [restockQty, setRestockQty] = useState('');
  const [restockNote, setRestockNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [productsRes, logsRes] = await Promise.all([
        authFetch('/api/inventory').then(r => r.json()),
        supabase.from('stock_logs').select('*, products(name)').order('created_at', { ascending: false }).limit(50),
      ]);
      setProducts(productsRes || []);
      setStockLogs(logsRes.data || []);
    } catch { /* */ }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleRestock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct || !restockQty) return;
    setSaving(true); setMessage(null);
    try {
      const product = products.find(p => p.id === selectedProduct);
      if (!product) throw new Error('Produk tidak ditemukan');
      const qty = Number.parseInt(restockQty);
      if (qty <= 0) throw new Error('Jumlah harus lebih dari 0');

      const { error: updateError } = await supabase.from('products').update({ stock: product.stock + qty }).eq('id', selectedProduct);
      if (updateError) throw updateError;

      const { error: logError } = await supabase.from('stock_logs').insert({
        product_id: selectedProduct, type: 'restock', quantity: qty,
        note: restockNote || `Restock ${qty} unit`,
      });
      if (logError) throw logError;

      setMessage({ type: 'success', text: `✓ Berhasil restock ${product.name} +${qty}` });
      setSelectedProduct(''); setRestockQty(''); setRestockNote('');
      fetchData();
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Gagal restock' });
    } finally { setSaving(false); }
  };

  const typeLabel = (type: string) => {
    switch (type) {
      case 'restock': return { text: 'Restock', cls: 'badge-green' };
      case 'sale': return { text: 'Penjualan', cls: 'badge-blue' };
      case 'adjustment': return { text: 'Penyesuaian', cls: 'badge-yellow' };
      default: return { text: type, cls: '' };
    }
  };

  const lowStockProducts = products.filter(p => p.stock <= 5);

  if (loading) {
    return (
      <div className="p-6 flex justify-center py-12" style={{ background: 'var(--bg-primary)' }}>
        <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--accent-blue)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto" style={{ background: 'var(--bg-primary)', minHeight: '100vh' }}>
      <h1 className="text-xl font-bold mb-6 animate-fade-in" style={{ color: 'var(--text-primary)' }}>📋 Inventori</h1>

      {message && <div className={`mb-4 ${message.type === 'success' ? 'alert-success' : 'alert-error'}`}>{message.text}</div>}

      {/* Restock Form */}
      <div className="glass-card p-5 mb-6 animate-fade-in">
        <h3 className="text-sm font-bold mb-4" style={{ color: 'var(--text-primary)' }}>📥 Restock Produk</h3>
        <form onSubmit={handleRestock} className="flex gap-3 items-end flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Produk</label>
            <select value={selectedProduct} onChange={e => setSelectedProduct(e.target.value)} required className="input-field">
              <option value="">Pilih produk...</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.name} (Stok: {p.stock})</option>)}
            </select>
          </div>
          <div className="w-32">
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Jumlah</label>
            <input type="number" value={restockQty} onChange={e => setRestockQty(e.target.value)} required min="1" className="input-field" />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Catatan</label>
            <input type="text" value={restockNote} onChange={e => setRestockNote(e.target.value)} className="input-field" placeholder="Opsional..." />
          </div>
          <button type="submit" disabled={saving} className="btn-success whitespace-nowrap">{saving ? '...' : '+ Restock'}</button>
        </form>
      </div>

      {/* Low Stock Alert */}
      {lowStockProducts.length > 0 && (
        <div className="mb-6 animate-fade-in">
          <h3 className="text-sm font-bold mb-3 flex items-center gap-2" style={{ color: 'var(--accent-red)' }}>
            🔔 Stok Rendah ({lowStockProducts.length} produk)
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 stagger-children">
            {lowStockProducts.map(p => (
              <div key={p.id} className="stat-card" style={{ borderColor: 'rgba(239, 68, 68, 0.3)' }}>
                <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{p.name}</p>
                <p className="text-lg font-bold mt-1" style={{ color: 'var(--accent-red)' }}>{p.stock}</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>unit tersisa</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stock Logs Table */}
      <div className="glass-card overflow-hidden animate-fade-in">
        <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border-default)' }}>
          <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>📖 Riwayat Stok</h3>
        </div>
        <table className="data-table">
          <thead><tr><th>Waktu</th><th>Produk</th><th>Tipe</th><th className="text-right">Jumlah</th><th>Catatan</th></tr></thead>
          <tbody>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {stockLogs.map((log: any) => {
              const t = typeLabel(log.type);
              return (
                <tr key={log.id}>
                  <td className="text-xs" style={{ color: 'var(--text-muted)' }}>{new Date(log.created_at).toLocaleString('id-ID')}</td>
                  <td style={{ color: 'var(--text-primary)' }}>{log.products?.name || '-'}</td>
                  <td><span className={`badge ${t.cls}`}>{t.text}</span></td>
                  <td className="text-right font-mono" style={{ color: log.quantity > 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                    {log.quantity > 0 ? '+' : ''}{log.quantity}
                  </td>
                  <td className="text-xs" style={{ color: 'var(--text-muted)' }}>{log.note || '-'}</td>
                </tr>
              );
            })}
            {stockLogs.length === 0 && <tr><td colSpan={5} className="text-center py-8" style={{ color: 'var(--text-muted)' }}>Belum ada riwayat</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
