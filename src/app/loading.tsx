export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-primary, #1a1a2e)' }}>
      <div className="flex flex-col items-center gap-4">
        <div
          className="w-10 h-10 border-3 rounded-full animate-spin"
          style={{ borderColor: '#0ea5e9', borderTopColor: 'transparent' }}
        />
        <p className="text-sm" style={{ color: '#888' }}>Memuat...</p>
      </div>
    </div>
  );
}
