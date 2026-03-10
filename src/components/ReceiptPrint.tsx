'use client';

import { useRef } from 'react';

interface ReceiptData {
  storeName: string;
  storeAddress: string;
  storePhone: string;
  date: Date;
  cashier: string;
  items: { name: string; qty: number; price: number; subtotal: number; }[];
  subtotal: number;
  discount: number;
  total: number;
  paymentMethod: string;
  transactionId: string;
  cashReceived?: number;
  change?: number;
}

export default function ReceiptPrint({ data, onClose }: Readonly<{ data: ReceiptData; onClose: () => void }>) {
  const receiptRef = useRef<HTMLDivElement>(null);

  const formatRupiah = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;
  const paymentLabel = (m: string) => m === 'cash' ? 'Tunai' : m === 'qris' ? 'QRIS' : 'Transfer';

  const handlePrint = () => {
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if (!printWindow || !receiptRef.current) return;

    const logoUrl = window.location.origin + '/logo.png';

    printWindow.document.write(`
      <html>
      <head>
        <title>Struk</title>
        <style>
          @page { margin: 0; size: 58mm auto; }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'Courier New', Courier, monospace;
            font-size: 11px;
            width: 48mm;
            padding: 3mm 2mm;
            color: #000;
            line-height: 1.5;
            -webkit-print-color-adjust: exact;
          }
          .center { text-align: center; }
          .right { text-align: right; }
          .bold { font-weight: bold; }
          .divider {
            border: none;
            border-top: 1px dashed #000;
            margin: 4px 0;
          }
          .row {
            display: flex;
            justify-content: space-between;
            padding: 1px 0;
          }
          .logo { width: 50px; height: auto; margin: 0 auto 4px; display: block; }
          .store-name { font-size: 13px; font-weight: bold; letter-spacing: 0.5px; }
          .store-info { font-size: 9px; line-height: 1.3; }
          .item-name { font-size: 11px; font-weight: bold; }
          .item-detail { font-size: 10px; }
          .total-row { font-size: 14px; font-weight: bold; padding: 2px 0; }
          .change-row { font-size: 13px; font-weight: bold; }
          .footer { font-size: 9px; margin-top: 6px; }
        </style>
      </head>
      <body>
        ${receiptRef.current.innerHTML.replace(/src="\/logo\.png"/g, `src="${logoUrl}"`)}
        <script>
          window.onload = function() { window.print(); window.close(); };
        <\/script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
      onKeyDown={e => e.key === 'Escape' && onClose()}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-sm animate-fade-in-scale"
        style={{ background: 'var(--bg-card)', borderRadius: '16px', boxShadow: 'var(--shadow-lg)' }}
        onClick={e => e.stopPropagation()}
        onKeyDown={() => {}}
        role="document"
      >
        {/* Receipt Preview */}
        <div className="p-4 overflow-auto" style={{ maxHeight: '70vh' }}>
          <div
            ref={receiptRef}
            style={{
              fontFamily: "'Courier New', Courier, monospace",
              fontSize: '12px',
              color: '#000',
              background: '#fff',
              padding: '12px 8px',
              borderRadius: '8px',
              lineHeight: '1.6',
            }}
          >
            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: '6px' }}>
              <img src="/logo.png" alt="Logo" style={{ width: '50px', height: 'auto', margin: '0 auto 4px', display: 'block' }} />
              <div style={{ fontSize: '14px', fontWeight: 'bold', letterSpacing: '0.5px' }}>{data.storeName}</div>
              <div style={{ fontSize: '9px', lineHeight: '1.4', marginTop: '2px', whiteSpace: 'pre-line' }}>
                {data.storeAddress}
              </div>
              <div style={{ fontSize: '9px' }}>{data.storePhone}</div>
            </div>

            <hr style={{ border: 'none', borderTop: '1px dashed #000', margin: '6px 0' }} />

            {/* Date + Transaction */}
            <div style={{ fontSize: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>{data.date.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                <span>{data.date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>No: {data.transactionId.slice(0, 8).toUpperCase()}</span>
                <span>Kasir: {data.cashier}</span>
              </div>
              <div>Bayar: {paymentLabel(data.paymentMethod)}</div>
            </div>

            <hr style={{ border: 'none', borderTop: '1px dashed #000', margin: '6px 0' }} />

            {/* Items */}
            {data.items.map((item, i) => (
              <div key={`receipt-${item.name}-${i}`} style={{ marginBottom: '4px' }}>
                <div style={{ fontWeight: 'bold', fontSize: '11px' }}>{item.name}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                  <span>&nbsp;&nbsp;{item.qty} x {formatRupiah(item.price)}</span>
                  <span>{formatRupiah(item.subtotal)}</span>
                </div>
              </div>
            ))}

            <hr style={{ border: 'none', borderTop: '1px dashed #000', margin: '6px 0' }} />

            {/* Totals */}
            {data.discount > 0 && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                  <span>Subtotal</span><span>{formatRupiah(data.subtotal)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                  <span>Diskon</span><span>-{formatRupiah(data.discount)}</span>
                </div>
              </>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: 'bold', padding: '3px 0' }}>
              <span>TOTAL</span><span>{formatRupiah(data.total)}</span>
            </div>

            {/* Cash / Change */}
            {data.paymentMethod === 'cash' && (data.cashReceived || 0) > 0 && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                  <span>Bayar</span><span>{formatRupiah(data.cashReceived || 0)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 'bold' }}>
                  <span>Kembali</span><span>{formatRupiah(data.change || 0)}</span>
                </div>
              </>
            )}

            {/* Transfer info */}
            {data.paymentMethod === 'transfer' && (
              <div style={{ textAlign: 'center', fontSize: '10px', marginTop: '2px' }}>
                <div>Transfer ke BCA: 6830841685</div>
                <div>a.n Toko Plastik</div>
              </div>
            )}

            <hr style={{ border: 'none', borderTop: '1px dashed #000', margin: '8px 0' }} />

            {/* Footer */}
            <div style={{ textAlign: 'center', fontSize: '10px', lineHeight: '1.6' }}>
              <div style={{ fontWeight: 'bold' }}>Terima Kasih</div>
              <div>Selamat Berbelanja</div>
              <div style={{ fontSize: '8px', marginTop: '4px', color: '#666' }}>— Kebutuhan Sehari-hari, Penuh Berkah —</div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 p-4" style={{ borderTop: '1px solid var(--border-default)' }}>
          <button onClick={handlePrint} className="btn-primary flex-1 py-2.5 font-semibold">
            🖨️ Cetak Struk
          </button>
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg text-sm font-medium"
            style={{ background: 'var(--bg-input)', color: 'var(--text-secondary)' }}>
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
