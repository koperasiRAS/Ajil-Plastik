'use client';

import { useEffect, useState } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [isClientError, setIsClientError] = useState(false);

  useEffect(() => {
    // Log error to console for debugging
    console.error('=== Global Error Boundary ===');
    console.error('Error:', error);
    console.error('Digest:', error.digest);
    console.error('=============================');
    setIsClientError(true);
  }, [error]);

  return (
    <html>
      <body className="min-h-screen flex items-center justify-center" style={{ background: '#1a1a2e', color: '#eee' }}>
        <div className="max-w-md p-6 text-center">
          <div className="text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold mb-2">Terjadi Kesalahan</h2>
          <p className="text-gray-400 mb-4">
            {isClientError && error.message
              ? error.message
              : ' Aplikasi mengalami masalah. Silakan coba lagi.'}
          </p>
          {error.digest && (
            <p className="text-xs text-gray-500 mb-4">Error ID: {error.digest}</p>
          )}
          <button
            onClick={reset}
            className="px-6 py-2 rounded-lg font-medium transition-all hover:opacity-90"
            style={{ background: '#0ea5e9', color: 'white' }}
          >
            Coba Lagi
          </button>
          <div className="mt-6 pt-4 border-t border-gray-700">
            <p className="text-xs text-gray-500">
              Jika masalah terus berlanjut, silakan hubungi administrator.
            </p>
          </div>
        </div>
      </body>
    </html>
  );
}
