'use client';

import { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Product, Category } from '@/lib/types';
import { uploadProductImage } from '@/lib/imageUpload';

export default function ProductsPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [filterCategory, setFilterCategory] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const [name, setName] = useState('');
  const [barcode, setBarcode] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageObjectUrl, setImageObjectUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  const { data: productsData, isLoading } = useQuery({
    queryKey: ['products-page'],
    queryFn: async () => {
      const prodRes = await supabase.from('products').select('*, categories(name)').order('name');
      let categories: Category[] = [];
      try {
        const catRes = await supabase.from('categories').select('*').order('name');
        categories = (catRes.data as Category[]) || [];
      } catch { /* ignore */ }
      return {
        products: (prodRes.data as Product[]) || [],
        categories,
      };
    },
  });

  const products = productsData?.products || [];
  const categories = productsData?.categories || [];
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['products-page'] });

  const resetForm = () => {
    if (imageObjectUrl) URL.revokeObjectURL(imageObjectUrl);
    setName(''); setBarcode(''); setCostPrice(''); setPrice(''); setStock(''); setCategoryId('');
    setImagePreview(null); setImageFile(null); setImageObjectUrl(null);
    setEditingProduct(null); setShowForm(false);
  };

  const openEditForm = (product: Product) => {
    setEditingProduct(product);
    setName(product.name); setBarcode(product.barcode);
    setCostPrice(String(product.cost_price || 0)); setPrice(String(product.price));
    setStock(String(product.stock)); setCategoryId(product.category_id || '');
    setImagePreview(product.image_url || null); setImageFile(null);
    setShowForm(true);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'Ukuran file maksimal 5MB' });
      return;
    }
    if (imageObjectUrl) URL.revokeObjectURL(imageObjectUrl);
    const newObjectUrl = URL.createObjectURL(file);
    setImageFile(file);
    setImagePreview(newObjectUrl);
    setImageObjectUrl(newObjectUrl);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setMessage(null);

    try {
      let imageUrl = editingProduct?.image_url || null;
      if (imageFile) {
        setUploading(true);
        const tempId = editingProduct?.id || crypto.randomUUID();
        imageUrl = await uploadProductImage(imageFile, tempId);
        setUploading(false);
      }

      const productData = {
        name, barcode, cost_price: Number.parseFloat(costPrice) || 0,
        price: Number.parseFloat(price), stock: Number.parseInt(stock),
        image_url: imageUrl, category_id: categoryId || null,
      };

      if (editingProduct) {
        const { error } = await supabase.from('products').update(productData).eq('id', editingProduct.id);
        if (error) throw error;
        setMessage({ type: 'success', text: '✓ Produk berhasil diperbarui' });
      } else {
        const { error } = await supabase.from('products').insert(productData);
        if (error) throw error;
        setMessage({ type: 'success', text: '✓ Produk berhasil ditambahkan' });
      }
      resetForm(); invalidate();
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Gagal menyimpan' });
    } finally { setSaving(false); setUploading(false); }
  };

  const deleteProduct = async (id: string) => {
    if (!confirm('Hapus produk ini?')) return;
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) setMessage({ type: 'error', text: 'Gagal menghapus produk' });
    else { setMessage({ type: 'success', text: '✓ Produk dihapus' }); invalidate(); }
  };

  const addCategory = async () => {
    if (!newCategoryName.trim()) return;
    const { error } = await supabase.from('categories').insert({ name: newCategoryName.trim() });
    if (error) setMessage({ type: 'error', text: error.message });
    else { setNewCategoryName(''); setShowCategoryForm(false); invalidate(); }
  };

  const formatRupiah = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;

  const filtered = products.filter(p => {
    if (filterCategory && p.category_id !== filterCategory) return false;
    if (searchQuery && !p.name.toLowerCase().includes(searchQuery.toLowerCase()) && !p.barcode.includes(searchQuery)) return false;
    return true;
  });

  const exportCSV = () => {
    const headers = ['Nama', 'Barcode', 'Harga', 'Stok', 'Kategori'];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = filtered.map(p => [p.name, p.barcode, p.price, p.stock, (p as any).categories?.name || '-']);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'produk.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto" style={{ background: 'var(--bg-primary)', minHeight: '100vh' }}>
      <div className="flex items-center justify-between mb-6 animate-fade-in">
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>📦 Daftar Produk</h1>
        <div className="flex gap-2">
          <button onClick={exportCSV} className="px-3 py-2 rounded-lg text-sm transition-all hover:scale-105"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}>📥 CSV</button>
          <button onClick={() => setShowCategoryForm(!showCategoryForm)} className="px-3 py-2 rounded-lg text-sm transition-all hover:scale-105"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}>🏷️ Kategori</button>
          <button onClick={() => { resetForm(); setShowForm(true); }} className="btn-primary px-4 py-2">+ Tambah Produk</button>
        </div>
      </div>

      {message && <div className={`mb-4 ${message.type === 'success' ? 'alert-success' : 'alert-error'}`}>{message.text}</div>}

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
      </div>

      {showForm && (
        <div className="glass-card p-5 mb-6 animate-fade-in-scale">
          <h3 className="text-sm font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
            {editingProduct ? '✏️ Edit Produk' : '➕ Tambah Produk Baru'}
          </h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs mb-2" style={{ color: 'var(--text-muted)' }}>📸 Foto Produk</label>
              <div className="flex items-center gap-4">
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="w-28 h-28 rounded-xl flex items-center justify-center cursor-pointer transition-all duration-200 hover:scale-105 overflow-hidden"
                  style={{ background: 'var(--bg-input)', border: '2px dashed var(--border-hover)' }}
                >
                  {imagePreview ? (
                    <img src={imagePreview} alt="Preview" loading="lazy" className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-center">
                      <span className="text-2xl">📷</span>
                      <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Upload</p>
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Klik untuk upload foto</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Format: JPG, PNG, WebP (maks 5MB)</p>
                  {uploading && <p className="text-xs mt-1" style={{ color: 'var(--accent-blue)' }}>⏳ Mengupload...</p>}
                </div>
                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp"
                  onChange={handleImageSelect} className="hidden" />
              </div>
            </div>

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
            <div className="col-span-2"><label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Kategori</label>
              <select value={categoryId} onChange={e => setCategoryId(e.target.value)} className="input-field">
                <option value="">Pilih kategori...</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select></div>

            <div className="col-span-2 flex gap-2">
              <button type="submit" disabled={saving || uploading} className="btn-primary">
                {uploading ? '⏳ Upload...' : saving ? 'Menyimpan...' : editingProduct ? 'Perbarui' : 'Simpan'}
              </button>
              <button type="button" onClick={resetForm} className="px-4 py-2 rounded-lg text-sm"
                style={{ background: 'var(--bg-input)', color: 'var(--text-secondary)' }}>Batal</button>
            </div>
          </form>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--accent-blue)', borderTopColor: 'transparent' }} />
        </div>
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
                      {product.image_url ? (
                        <img src={product.image_url} alt={product.name} loading="lazy" className="w-12 h-12 rounded-lg object-cover" />
                      ) : (
                        <div className="w-12 h-12 rounded-lg flex items-center justify-center text-lg" style={{ background: 'var(--bg-input)' }}>📦</div>
                      )}
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
                    <button onClick={() => deleteProduct(product.id)} className="text-xs px-2 py-1 rounded transition-all hover:scale-110" style={{ color: 'var(--accent-red)' }}>Hapus</button>
                  </td>
                </tr>
              )})}
              {filtered.length === 0 && <tr><td colSpan={8} className="text-center py-8" style={{ color: 'var(--text-muted)' }}>Belum ada produk</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
