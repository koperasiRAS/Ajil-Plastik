'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Product, Category } from '@/lib/types';
import { formatRupiah } from '@/lib/format';
import { exportToCSV } from '@/lib/exportCSV';
import { AlertMessage, useAlert } from '@/components/AlertMessage';
import { LoadingCenter } from '@/components/LoadingSpinner';
import { broadcastCacheInvalidation } from '@/hooks/useCrossTabSync';
import { useAuth } from '@/components/AuthProvider';

export default function ProductsPage() {
  const queryClient = useQueryClient();
  const { store } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);
  const { alert, setAlert, clearAlert } = useAlert();
  const [filterCategory, setFilterCategory] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const PRODUCTS_PER_PAGE = 50; // Limit products per page for performance

  const [name, setName] = useState('');
  const [barcode, setBarcode] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('');
  const [categoryId, setCategoryId] = useState('');

  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  const { data: productsData, isLoading, refetch } = useQuery({
    queryKey: ['products-page', store?.id, currentPage],
    queryFn: async () => {
      const offset = (currentPage - 1) * PRODUCTS_PER_PAGE;
      // For owners: show all products (store-specific + shared products with null store_id)
      // For employees: show products matching current store OR shared products (null store_id)
      let prodRes;
      if (store?.id) {
        // Use .or() to include both store-specific products and shared products (null store_id)
        prodRes = await supabase
          .from('products')
          .select('*, categories(name)', { count: 'exact' })
          .or(`store_id.eq.${store.id},store_id.is.null`)
          .order('name')
          .range(offset, offset + PRODUCTS_PER_PAGE - 1);
      } else {
        // No store selected - show all products
        prodRes = await supabase.from('products').select('*, categories(name)').order('name');
      }
      let categories: Category[] = [];
      try {
        const catRes = await supabase.from('categories').select('*').order('name');
        categories = (catRes.data as Category[]) || [];
      } catch { /* ignore */ }
      return {
        products: (prodRes.data as Product[]) || [],
        categories,
        count: prodRes.count || 0,
      };
    },
  });

  const products = productsData?.products || [];
  const categories = productsData?.categories || [];
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['products-page'] });

  const resetForm = () => {
    setName(''); setBarcode(''); setCostPrice(''); setPrice(''); setStock(''); setCategoryId('');
    setEditingProduct(null); setShowForm(false);
  };

  const openEditForm = (product: Product) => {
    setEditingProduct(product);
    setName(product.name); setBarcode(product.barcode);
    setCostPrice(String(product.cost_price || 0)); setPrice(String(product.price));
    setStock(String(product.stock)); setCategoryId(product.category_id || '');
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); clearAlert();

    try {
      const productData = {
        name, barcode, cost_price: Number.parseFloat(costPrice) || 0,
        price: Number.parseFloat(price), stock: Number.parseInt(stock),
        category_id: categoryId || null,
        store_id: store?.id || null, // Associate product with current store
      };

      if (editingProduct) {
        // When editing, preserve the store_id if not provided
        const updateData = {
          ...productData,
          store_id: editingProduct.store_id || store?.id || null,
        };
        const { error } = await supabase.from('products').update(updateData).eq('id', editingProduct.id);
        if (error) throw error;
        setAlert('success', '✓ Produk berhasil diperbarui');
      } else {
        const { error } = await supabase.from('products').insert(productData);
        if (error) throw error;
        setAlert('success', '✓ Produk berhasil ditambahkan');
      }
      resetForm(); invalidate();
      // Also invalidate POS product cache so POS re-fetches on next visit
      queryClient.invalidateQueries({ queryKey: ['products'] });
      broadcastCacheInvalidation(['products']);
    } catch (err) {
      setAlert('error', err instanceof Error ? err.message : 'Gagal menyimpan');
    } finally { setSaving(false); }
  };

  const archiveProduct = async (id: string, productName: string) => {
    if (!confirm(`Arsipkan produk "${productName}"? Produk akan disembunyikan dari POS tapi riwayat transaksi tetap aman.`)) return;
    const { error } = await supabase.from('products').update({ is_active: false }).eq('id', id);
    if (error) {
      // Fallback: if is_active column doesn't exist yet, show a message
      setAlert('error', 'Gagal mengarsipkan. Pastikan kolom is_active sudah ada di tabel products.');
    } else {
      setAlert('success', `✓ Produk "${productName}" diarsipkan`);
      invalidate();
      // Also invalidate POS product cache
      queryClient.invalidateQueries({ queryKey: ['products'] });
      broadcastCacheInvalidation(['products']);
    }
  };

  const restoreProduct = async (id: string, productName: string) => {
    const { error } = await supabase.from('products').update({ is_active: true }).eq('id', id);
    if (error) setAlert('error', 'Gagal memulihkan produk');
    else {
      setAlert('success', `✓ Produk "${productName}" dipulihkan`);
      invalidate();
      queryClient.invalidateQueries({ queryKey: ['products'] });
      broadcastCacheInvalidation(['products']);
    }
  };

  const addCategory = async () => {
    if (!newCategoryName.trim()) return;
    const { error } = await supabase.from('categories').insert({ name: newCategoryName.trim() });
    if (error) setAlert('error', error.message);
    else { setNewCategoryName(''); setShowCategoryForm(false); invalidate(); }
  };

  const filtered = products.filter(p => {
    // Filter by archive status - default true if column missing
    const isActive = p.is_active !== false;
    if (!showArchived && !isActive) return false;
    if (showArchived && isActive) return false;
    if (filterCategory && p.category_id !== filterCategory) return false;
    if (searchQuery && !p.name.toLowerCase().includes(searchQuery.toLowerCase()) && !p.barcode.includes(searchQuery)) return false;
    return true;
  });

  const handleExportCSV = () => {
    const headers = ['Nama', 'Barcode', 'Harga', 'Stok', 'Kategori'];
    const rows = filtered.map(p => [p.name, p.barcode, p.price, p.stock, p.categories?.name || '-'] as (string | number)[]);
    exportToCSV(headers, rows, 'produk.csv');
  };

  return (
    <div className="p-6 max-w-6xl mx-auto" style={{ background: 'var(--bg-primary)', minHeight: '100vh' }}>
      <div className="flex items-center justify-between mb-6 animate-fade-in">
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>📦 Daftar Produk</h1>
        <div className="flex gap-2">
          <button onClick={handleExportCSV} className="px-3 py-2 rounded-lg text-sm transition-all hover:scale-105"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}>📥 CSV</button>
          <button onClick={() => setShowCategoryForm(!showCategoryForm)} className="px-3 py-2 rounded-lg text-sm transition-all hover:scale-105"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}>🏷️ Kategori</button>
          <button onClick={() => { resetForm(); setShowForm(true); }} className="btn-primary px-4 py-2">+ Tambah Produk</button>
        </div>
      </div>

      {alert && <AlertMessage type={alert.type} message={alert.message} onClose={clearAlert} />}

      {showCategoryForm && (
        <div className="glass-card p-4 mb-4 flex gap-2 items-end animate-fade-in-scale">
          <div className="flex-1">
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Tambah Kategori Baru</label>
            <input type="text" value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addCategory()} className="input-field" placeholder="Nama kategori..." />
          </div>
          <button onClick={addCategory} className="btn-primary">Tambah</button>
        </div>
      )}

      <div className="flex gap-3 mb-4 animate-fade-in">
        <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
          placeholder="🔍 Cari produk..." className="input-field flex-1" />
        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="input-field w-48">
          <option value="">Semua Kategori</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button
          onClick={() => setShowArchived(!showArchived)}
          className="px-3 py-2 rounded-lg text-sm transition-all hover:scale-105 whitespace-nowrap"
          style={{
            background: showArchived ? 'var(--accent-red)' : 'var(--bg-card)',
            color: showArchived ? 'white' : 'var(--text-secondary)',
            border: '1px solid ' + (showArchived ? 'var(--accent-red)' : 'var(--border-default)'),
          }}
        >
          {showArchived ? '📦 Arsip' : '📦 Lihat Arsip'}
        </button>
      </div>

      {showForm && (
        <div className="glass-card p-5 mb-6 animate-fade-in-scale">
          <h3 className="text-sm font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
            {editingProduct ? '✏️ Edit Produk' : '➕ Tambah Produk Baru'}
          </h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
            <div><label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Nama Produk *</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} required className="input-field" placeholder="Cth: Indomie Goreng" /></div>
            <div><label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Barcode *</label>
              <input type="text" value={barcode} onChange={e => setBarcode(e.target.value)} required className="input-field" placeholder="Scan atau ketik manual" /></div>
            <div><label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Harga Modal (Rp) *</label>
              <input type="number" value={costPrice} onChange={e => setCostPrice(e.target.value)} required min="0" className="input-field" placeholder="Harga beli" /></div>
            <div><label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Harga Jual (Rp) *</label>
              <input type="number" value={price} onChange={e => setPrice(e.target.value)} required min="0" className="input-field" placeholder="Harga jual" /></div>
            <div><label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Stok Awal *</label>
              <input type="number" value={stock} onChange={e => setStock(e.target.value)} required min="0" className="input-field" /></div>
            <div><label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Kategori</label>
              <select value={categoryId} onChange={e => setCategoryId(e.target.value)} className="input-field">
                <option value="">Pilih kategori...</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select></div>

            <div className="col-span-2 flex gap-2">
              <button type="submit" disabled={saving} className="btn-primary">
                {saving ? 'Menyimpan...' : editingProduct ? 'Perbarui' : 'Simpan'}
              </button>
              <button type="button" onClick={resetForm} className="px-4 py-2 rounded-lg text-sm"
                style={{ background: 'var(--bg-input)', color: 'var(--text-secondary)' }}>Batal</button>
            </div>
          </form>
        </div>
      )}

      {isLoading ? (
        <LoadingCenter />
      ) : (
        <div className="glass-card overflow-hidden">
          <table className="data-table">
            <thead>
              <tr><th>Produk</th><th>Barcode</th><th>Kategori</th><th className="text-right">Modal</th><th className="text-right">Jual</th><th className="text-right">Margin</th><th className="text-right">Stok</th><th className="text-right">Aksi</th></tr>
            </thead>
            <tbody>
              {filtered.map(product => {
                const margin = product.cost_price > 0 ? ((product.price - product.cost_price) / product.cost_price * 100) : 0;
                return (
                <tr key={product.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      {/* Using emoji instead of image for better performance */}
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center text-lg" style={{ background: 'var(--bg-input)' }}>📦</div>
                      <span style={{ color: 'var(--text-primary)' }}>{product.name}</span>
                    </div>
                  </td>
                  <td><span className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>{product.barcode}</span></td>
                  <td>{product.categories?.name ? <span className="badge badge-blue">{product.categories.name}</span> : <span style={{ color: 'var(--text-muted)' }}>-</span>}</td>
                  <td className="text-right text-xs" style={{ color: 'var(--text-muted)' }}>{formatRupiah(product.cost_price || 0)}</td>
                  <td className="text-right" style={{ color: 'var(--accent-blue)' }}>{formatRupiah(product.price)}</td>
                  <td className="text-right">
                    <span className={`badge ${margin > 20 ? 'badge-green' : margin > 0 ? 'badge-yellow' : 'badge-red'}`}>
                      {margin.toFixed(0)}%
                    </span>
                  </td>
                  <td className="text-right">
                    <span className={`badge ${product.stock <= 5 ? 'badge-red' : 'badge-green'}`}>{product.stock}</span>
                  </td>
                  <td className="text-right">
                    <button onClick={() => openEditForm(product)} className="text-xs mr-2 px-2 py-1 rounded transition-all hover:scale-110" style={{ color: 'var(--accent-blue)' }}>Edit</button>
                    {showArchived ? (
                      <button onClick={() => restoreProduct(product.id, product.name)} className="text-xs px-2 py-1 rounded transition-all hover:scale-110" style={{ color: 'var(--accent-green)' }}>Pulihkan</button>
                    ) : (
                      <button onClick={() => archiveProduct(product.id, product.name)} className="text-xs px-2 py-1 rounded transition-all hover:scale-110" style={{ color: 'var(--accent-red)' }}>Arsipkan</button>
                    )}
                  </td>
                </tr>
              )})}
              {filtered.length === 0 && <tr><td colSpan={8} className="text-center py-8" style={{ color: 'var(--text-muted)' }}>Belum ada produk</td></tr>}
            </tbody>
          </table>

          {/* Pagination Controls */}
          {(productsData?.count || 0) > PRODUCTS_PER_PAGE && (
            <div className="flex items-center justify-between px-4 py-3" style={{ borderTop: '1px solid var(--border-default)' }}>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Halaman {currentPage} dari {Math.ceil((productsData?.count || 0) / PRODUCTS_PER_PAGE)} ({productsData?.count || 0} produk)
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 text-xs rounded disabled:opacity-50"
                  style={{ background: 'var(--bg-input)', color: 'var(--text-secondary)' }}
                >← Sebelumnya</button>
                <button
                  onClick={() => setCurrentPage(p => p + 1)}
                  disabled={currentPage >= Math.ceil((productsData?.count || 0) / PRODUCTS_PER_PAGE)}
                  className="px-3 py-1 text-xs rounded disabled:opacity-50"
                  style={{ background: 'var(--bg-input)', color: 'var(--text-secondary)' }}
                >Selanjutnya →</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
