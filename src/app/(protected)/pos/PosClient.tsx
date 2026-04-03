'use client';

import { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner';
import { Product, CartItem, Category } from '@/lib/types';
import { queryClient } from '@/lib/queryClient';
import { useDebounce } from 'use-debounce';
import { broadcastCacheInvalidation } from '@/hooks/useCrossTabSync';

// Lazy Load ReceiptPrint Component
const ReceiptPrint = dynamic(() => import('@/components/ReceiptPrint'), { ssr: false });

import { useQuery, useMutation } from '@tanstack/react-query';
import { LoadingCenter } from '@/components/LoadingSpinner';

export default function PosClient() {
  const { user, store } = useAuth();

  // Fetch categories
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data } = await supabase.from('categories').select('*').order('name');
      return (data as Category[]) || [];
    },
    staleTime: 10 * 60 * 1000,
  });

  // Fetch active products — align filter with products/page: exact store_id OR null (global products)
  const { data: products = [], isLoading: isLoadingProducts } = useQuery({
    queryKey: ['products', store?.id],
    queryFn: async () => {
      let query;
      if (store?.id) {
        query = supabase
          .from('products')
          .select('*, categories(name)')
          .or(`store_id.eq.${store.id},store_id.is.null`)
          .or('is_active.is.true,is_active.is.null')
          .order('name')
          .limit(500);
      } else {
        query = supabase
          .from('products')
          .select('*, categories(name)')
          .or('is_active.is.true,is_active.is.null')
          .order('name')
          .limit(500);
      }
      const { data } = await query;
      return (data as Product[]) || [];
    },
    staleTime: 2 * 60 * 1000,
  });

  const [cart, setCart] = useState<CartItem[]>([]);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery] = useDebounce(searchQuery, 300); // Debounce search 300ms
  
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [checkingOut, setCheckingOut] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'qris' | 'transfer'>('cash');
  const [discount, setDiscount] = useState('');
  const [cashReceived, setCashReceived] = useState('');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [receiptData, setReceiptData] = useState<any>(null);

  const addToCart = useCallback((product: Product) => {
    if (product.stock <= 0) {
      setMessage({ type: 'error', text: `Stok ${product.name} habis!` });
      setTimeout(() => setMessage(null), 2000);
      return;
    }
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) {
          setMessage({ type: 'error', text: `Stok ${product.name} tidak cukup!` });
          return prev;
        }
        return prev.map(item =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
    setMessage({ type: 'success', text: `✓ ${product.name}` });
    setTimeout(() => setMessage(null), 1500);
  }, []);

  // Barcode scan — filter by store to avoid cross-store barcode collisions
  const handleScan = useCallback(async (barcode: string) => {
    let query = supabase.from('products').select('*, categories(name)').eq('barcode', barcode);
    if (store?.id) {
      query = query.or(`store_id.eq.${store.id},store_id.is.null`);
    }
    const { data, error } = await query.single();
    if (error || !data) {
      setMessage({ type: 'error', text: `❌ Produk tidak ditemukan: ${barcode}` });
      setTimeout(() => setMessage(null), 3000);
      return;
    }
    addToCart(data as Product);
  }, [addToCart, store?.id]);

  // Enable barcode scanner
  useBarcodeScanner({ onScan: handleScan, enabled: true });

  // Filter products using DEBOUNCED SEARCH
  const filteredProducts = products.filter(p => {
    if (activeCategory !== 'all' && p.category_id !== activeCategory) return false;
    if (debouncedSearchQuery) {
      const q = debouncedSearchQuery.toLowerCase();
      return p.name.toLowerCase().includes(q) || p.barcode.includes(debouncedSearchQuery);
    }
    return true;
  });

  // Cart operations
  const updateQuantity = (productId: string, newQty: number) => {
    if (newQty <= 0) { setCart(prev => prev.filter(item => item.product.id !== productId)); return; }
    // Validate stock before updating
    const cartItem = cart.find(item => item.product.id === productId);
    if (cartItem && newQty > cartItem.product.stock) {
      setMessage({ type: 'error', text: `Stok ${cartItem.product.name} tidak cukup!` });
      return;
    }
    setCart(prev => prev.map(item =>
      item.product.id === productId ? { ...item, quantity: newQty } : item
    ));
  };
  const removeFromCart = (productId: string) => setCart(prev => prev.filter(item => item.product.id !== productId));

  const subtotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const discountAmount = Number.parseFloat(discount) || 0;
  const total = Math.max(0, subtotal - discountAmount);

  // Checkout mutation with optimistic stock update + proper rollback on error
  const checkoutMutation = useMutation({
    mutationFn: async () => {
      if (cart.length === 0 || !user) throw new Error('Keranjang kosong');

      // Validate current stock from server before checkout
      const productIds = cart.map(item => item.product.id);
      const { data: stockData, error: stockError } = await supabase
        .from('products')
        .select('id, stock')
        .in('id', productIds);

      if (stockError) throw new Error('Gagal validasi stok');

      // Check if any product has insufficient stock
      const stockMap = new Map(stockData?.map(p => [p.id, p.stock]) || []);
      for (const item of cart) {
        const currentStock = stockMap.get(item.product.id) ?? 0;
        if (currentStock < item.quantity) {
          throw new Error(`Stok ${item.product.name} tidak cukup! (Tersedia: ${currentStock})`);
        }
      }

      // Create transaction
      const { data: txn, error: txnError } = await supabase
        .from('transactions')
        .insert({ user_id: user.id, store_id: store?.id || null, total, payment_method: paymentMethod, discount: discountAmount })
        .select('id').single();

      if (txnError || !txn) throw new Error('Gagal membuat transaksi');

      const items = cart.map(item => ({
        transaction_id: txn.id, product_id: item.product.id,
        quantity: item.quantity, price: item.product.price,
        cost_price: item.product.cost_price || 0,
      }));
      const { error: itemsError } = await supabase.from('transaction_items').insert(items);
      if (itemsError) throw new Error('Gagal menyimpan item');

      // Build receipt data
      const cashReceivedNum = Number.parseFloat(cashReceived) || 0;
      const receipt = {
        storeName: 'Toko Plastik',
        storeAddress: 'Jl. Boulevard Gran City,\nJatimulya, Kec. Ci\nKota Depok, Jawa',
        storePhone: 'Telp: 628551218',
        date: new Date(),
        cashier: user.name,
        items: cart.map(item => ({
          name: item.product.name, qty: item.quantity, price: item.product.price,
          subtotal: item.product.price * item.quantity,
        })),
        subtotal, discount: discountAmount, total,
        paymentMethod, transactionId: txn.id,
        cashReceived: paymentMethod === 'cash' ? cashReceivedNum : 0,
        change: paymentMethod === 'cash' ? Math.max(0, cashReceivedNum - total) : 0,
      };

      // Update stock in DB
      const stockUpdateResults = await Promise.allSettled(cart.map(item =>
        Promise.all([
          supabase.from('products').update({ stock: (stockMap.get(item.product.id) ?? item.product.stock) - item.quantity }).eq('id', item.product.id),
          supabase.from('stock_logs').insert({
            product_id: item.product.id, type: 'sale', quantity: -item.quantity,
            note: `Penjualan - ${txn.id.slice(0, 8)}`,
          }),
        ])
      ));

      // Log any failures
      stockUpdateResults.forEach((result, index) => {
        if (result.status === 'rejected') {
          console.error(`Failed to update stock for ${cart[index].product.name}:`, result.reason);
        }
      });

      return { receipt, txnId: txn.id };
    },
    onMutate: async () => {
      // Cancel any outgoing refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: ['products', store?.id] });

      // Snapshot previous value for rollback
      const previousProducts = queryClient.getQueryData<Product[]>(['products', store?.id]);

      // Optimistically update stock in local cache
      queryClient.setQueryData<Product[]>(['products', store?.id], (old) => {
        if (!old) return old;
        return old.map(p => {
          const cartItem = cart.find(c => c.product.id === p.id);
          if (cartItem) return { ...p, stock: p.stock - cartItem.quantity };
          return p;
        });
      });

      setCheckingOut(true);
      setMessage(null);
      return { previousProducts };
    },
    onSuccess: ({ receipt }) => {
      // Show receipt and clear cart
      setReceiptData(receipt);
      setCart([]);
      setDiscount('');
      setCashReceived('');
      setPaymentMethod('cash');

      // Invalidate all related queries
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['products-page'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['low-stock-count'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['history'] });

      // Broadcast to other tabs
      broadcastCacheInvalidation(['dashboard', 'products', 'products-page', 'history', 'transactions']);
    },
    onError: (err, _vars, context) => {
      // Rollback optimistic update on error
      if (context?.previousProducts !== undefined) {
        queryClient.setQueryData(['products', store?.id], context.previousProducts);
      }
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Checkout gagal' });
    },
    onSettled: () => {
      setCheckingOut(false);
    },
  });

  const handleCheckout = () => checkoutMutation.mutate();

  const formatRupiah = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;

  return (
    <div className="flex flex-col lg:flex-row h-screen" style={{ background: 'var(--bg-primary)' }}>
      {/* LEFT — Product Grid */}
      <div className="flex-1 flex flex-col min-w-0 max-h-[55vh] lg:max-h-none">
        {/* Header + Search */}
        <div className="p-4 pb-0">
          <div className="flex items-center gap-3 mb-3 animate-fade-in">
            <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>🛒 POS Kasir</h2>
            <div className="flex-1" />
            {message && (
              <div className={`text-xs px-3 py-1.5 rounded-lg animate-fade-in ${message.type === 'success' ? 'alert-success' : 'alert-error'}`}>
                {message.text}
              </div>
            )}
          </div>

          {/* Search */}
          <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="🔍 Cari produk atau scan barcode..."
            className="input-field w-full mb-3" />

          {/* Category Tabs */}
          <div className="flex gap-1.5 overflow-x-auto pb-2 scrollbar-none">
            <button
              onClick={() => setActiveCategory('all')}
              className="px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all duration-200"
              style={{
                background: activeCategory === 'all' ? 'var(--accent-blue)' : 'var(--bg-input)',
                color: activeCategory === 'all' ? 'white' : 'var(--text-secondary)',
                border: '1px solid ' + (activeCategory === 'all' ? 'var(--accent-blue)' : 'var(--border-default)'),
              }}
            >
              Semua ({products.length})
            </button>
            {categories.map(cat => {
              const count = products.filter(p => p.category_id === cat.id).length;
              if (count === 0) return null;
              return (
                <button key={cat.id} onClick={() => setActiveCategory(cat.id)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all duration-200"
                  style={{
                    background: activeCategory === cat.id ? 'var(--accent-blue)' : 'var(--bg-input)',
                    color: activeCategory === cat.id ? 'white' : 'var(--text-secondary)',
                    border: '1px solid ' + (activeCategory === cat.id ? 'var(--accent-blue)' : 'var(--border-default)'),
                  }}
                >
                  {cat.name} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {/* Product Grid */}
        <div className="flex-1 overflow-auto p-4 pt-2">
          {isLoadingProducts ? (
            <div className="flex justify-center items-center h-full">
              <LoadingCenter />
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {filteredProducts.map(product => (
                <button
                  key={product.id}
                  onClick={() => addToCart(product)}
                  disabled={product.stock <= 0}
                  className="glass-card p-0 overflow-hidden text-left transition-all duration-200 group disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ cursor: product.stock > 0 ? 'pointer' : 'not-allowed' }}
                >
                  {/* Product Image - Using emoji instead of images for better performance */}
                  <div className="product-image-container relative flex items-center justify-center" style={{ background: 'var(--bg-input)' }}>
                    <div className="text-4xl">📦</div>
                    {product.stock <= 5 && product.stock > 0 && (
                      <span className="absolute top-1 right-1 badge badge-yellow text-[10px] px-1.5">Sisa {product.stock}</span>
                    )}
                    {product.stock <= 0 && (
                      <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)' }}>
                        <span className="text-white text-xs font-bold">HABIS</span>
                      </div>
                    )}
                  </div>
                  {/* Product Info */}
                  <div className="p-2.5">
                    <p className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>{product.name}</p>
                    {product.categories?.name && (
                      <p className="text-[10px] mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>{product.categories.name}</p>
                    )}
                    <p className="text-sm font-bold mt-1" style={{ color: 'var(--accent-blue)' }}>{formatRupiah(product.price)}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
          {filteredProducts.length === 0 && !isLoadingProducts && (
            <div className="flex flex-col items-center py-12 animate-fade-in">
               <span className="text-4xl mb-3">🔍</span>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Tidak ada produk ditemukan</p>
            </div>
          )}
        </div>

        <div className="px-4 py-2 text-xs text-center" style={{ color: 'var(--text-muted)', borderTop: '1px solid var(--border-default)' }}>
          💡 Scan barcode dengan scanner USB atau ketik manual • Klik produk untuk tambah ke keranjang
        </div>
      </div>

      {/* RIGHT — Cart */}
      <div className="w-full lg:w-80 xl:w-96 flex flex-col flex-1 lg:flex-none" style={{ background: 'var(--bg-secondary)', borderLeft: '1px solid var(--border-default)', borderTop: '1px solid var(--border-default)' }}>
        <div className="p-4 pb-2">
          <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
            🛍️ Keranjang ({cart.reduce((s, i) => s + i.quantity, 0)})
          </h3>
        </div>

        <div className="flex-1 overflow-auto px-4 space-y-2">
          {cart.length === 0 && (
            <div className="text-center py-12 animate-fade-in" style={{ color: 'var(--text-muted)' }}>
              <div className="text-4xl mb-2">🛒</div>
              <p className="text-sm">Keranjang kosong</p>
              <p className="text-xs mt-1">Klik produk untuk menambahkan</p>
            </div>
          )}
          {cart.map(item => (
            <div key={item.product.id} className="glass-card p-3 animate-fade-in">
              <div className="flex items-start gap-2.5">
                {/* Thumbnail - Using emoji instead of image for better performance */}
                <div className="w-10 h-10 rounded-lg shrink-0 flex items-center justify-center" style={{ background: 'var(--bg-input)' }}>
                  <span className="text-lg">📦</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between">
                    <p className="text-xs font-medium truncate pr-2" style={{ color: 'var(--text-primary)' }}>{item.product.name}</p>
                    <button onClick={() => removeFromCart(item.product.id)} className="p-0.5 rounded hover:scale-125 transition-transform flex-shrink-0"
                      style={{ color: 'var(--accent-red)', fontSize: '12px' }}>✕</button>
                  </div>
                  <div className="flex items-center justify-between mt-1.5">
                    <div className="flex items-center gap-1">
                      <button onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                        className="w-6 h-6 flex items-center justify-center rounded text-xs transition-all hover:scale-110"
                        style={{ background: 'var(--bg-input)', color: 'var(--text-primary)' }}>−</button>
                      <span className="w-6 text-center text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                        className="w-6 h-6 flex items-center justify-center rounded text-xs transition-all hover:scale-110"
                        style={{ background: 'var(--bg-input)', color: 'var(--text-primary)' }}>+</button>
                    </div>
                    <p className="text-xs font-semibold" style={{ color: 'var(--accent-blue)' }}>{formatRupiah(item.product.price * item.quantity)}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Checkout Panel */}
        <div className="p-4 space-y-3" style={{ borderTop: '1px solid var(--border-default)' }}>
          {/* Payment Method */}
          <div>
            <p className="text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>Metode Bayar</p>
            <div className="flex gap-1">
              {(['cash', 'qris', 'transfer'] as const).map(method => (
                <button key={method} onClick={() => { setPaymentMethod(method); setCashReceived(''); }}
                  className="flex-1 py-2 rounded-lg text-xs font-medium transition-all duration-200"
                  style={{
                    background: paymentMethod === method ? 'var(--accent-blue)' : 'var(--bg-input)',
                    color: paymentMethod === method ? 'white' : 'var(--text-secondary)',
                    border: '1px solid ' + (paymentMethod === method ? 'var(--accent-blue)' : 'var(--border-default)'),
                  }}>
                  {method === 'cash' ? '💵 Cash' : method === 'qris' ? '📱 QRIS' : '🏦 Transfer'}
                </button>
              ))}
            </div>
          </div>

          {/* Payment Method Details */}
          {paymentMethod === 'transfer' && (
            <div className="p-3 rounded-lg text-xs animate-fade-in" style={{ background: 'var(--bg-input)', border: '1px solid var(--border-default)' }}>
              <p className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>🏦 Rekening Transfer</p>
              <p style={{ color: 'var(--accent-blue)' }}>BCA: <span className="font-mono font-bold">6830841685</span></p>
              <p className="mt-0.5" style={{ color: 'var(--text-muted)' }}>a.n Toko Plastik</p>
            </div>
          )}
          {paymentMethod === 'qris' && (
            <div className="p-3 rounded-lg text-xs animate-fade-in" style={{ background: 'var(--bg-input)', border: '1px solid var(--border-default)' }}>
              <p className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>📱 QRIS — Scan QR Fisik</p>
              <p style={{ color: 'var(--text-muted)' }}>Pembeli scan QR code fisik di kasir</p>
              <p className="mt-1 font-bold text-sm" style={{ color: 'var(--accent-blue)' }}>Nominal: {formatRupiah(total)}</p>
            </div>
          )}

          {/* Discount */}
          <div>
            <p className="text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>Diskon (Rp)</p>
            <input type="number" value={discount} onChange={e => setDiscount(e.target.value)}
              placeholder="0" min="0" className="input-field" />
          </div>

          {/* Totals */}
          <div className="space-y-1">
            {discountAmount > 0 && (
              <>
                <div className="flex justify-between text-xs" style={{ color: 'var(--text-secondary)' }}>
                  <span>Subtotal</span><span>{formatRupiah(subtotal)}</span>
                </div>
                <div className="flex justify-between text-xs" style={{ color: 'var(--accent-red)' }}>
                  <span>Diskon</span><span>-{formatRupiah(discountAmount)}</span>
                </div>
              </>
            )}
            <div className="flex items-center justify-between pt-1">
              <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Total</span>
              <span className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{formatRupiah(total)}</span>
            </div>
          </div>

          {/* Cash Input + Change */}
          {paymentMethod === 'cash' && total > 0 && (
            <div className="animate-fade-in space-y-2">
              <div>
                <p className="text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>💵 Uang Diterima (Rp)</p>
                <input type="number" value={cashReceived} onChange={e => setCashReceived(e.target.value)}
                  placeholder="Masukkan nominal..." min="0" className="input-field text-lg font-bold" />
              </div>
              {(Number.parseFloat(cashReceived) || 0) >= total && (Number.parseFloat(cashReceived) || 0) > 0 && (
                <div className="p-3 rounded-lg text-center animate-fade-in-scale" style={{ background: 'var(--accent-green)', color: 'white' }}>
                  <p className="text-xs opacity-80">Kembalian</p>
                  <p className="text-2xl font-bold">{formatRupiah((Number.parseFloat(cashReceived) || 0) - total)}</p>
                </div>
              )}
              {(Number.parseFloat(cashReceived) || 0) > 0 && (Number.parseFloat(cashReceived) || 0) < total && (
                <div className="p-2 rounded-lg text-center text-xs" style={{ background: 'var(--accent-red)', color: 'white', opacity: 0.8 }}>
                  ⚠️ Uang kurang {formatRupiah(total - (Number.parseFloat(cashReceived) || 0))}
                </div>
              )}
            </div>
          )}

          {/* Transfer: show bank info on receipt too */}
          {paymentMethod === 'transfer' && total > 0 && (
            <div className="p-3 rounded-lg text-center animate-fade-in" style={{ background: 'var(--accent-blue)', color: 'white', opacity: 0.9 }}>
              <p className="text-xs opacity-80">Total Transfer</p>
              <p className="text-2xl font-bold">{formatRupiah(total)}</p>
            </div>
          )}

          <button onClick={handleCheckout} disabled={cart.length === 0 || checkingOut}
            className="btn-success w-full py-3 text-base font-bold disabled:opacity-40" style={{ borderRadius: '10px' }}>
            {checkingOut ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Memproses...
              </span>
            ) : '💰 Bayar & Cetak Struk'}
          </button>
        </div>
      </div>

      {/* Receipt Modal Loading dynamically */}
      {receiptData && <ReceiptPrint data={receiptData} onClose={() => setReceiptData(null)} />}
    </div>
  );
}
