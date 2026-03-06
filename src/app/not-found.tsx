import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 px-4">
      <div className="text-center">
        <div className="text-6xl mb-4">🔍</div>
        <h1 className="text-2xl font-bold text-white mb-2">Halaman Tidak Ditemukan</h1>
        <p className="text-gray-400 text-sm mb-6">Halaman yang Anda cari tidak tersedia.</p>
        <Link
          href="/"
          className="inline-block px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          Kembali ke Beranda
        </Link>
      </div>
    </div>
  );
}
