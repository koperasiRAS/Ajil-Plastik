/**
 * Reusable Loading Spinner Component
 * Replaces 14+ identical spinner implementations across the app
 */

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: 'blue' | 'green' | 'red' | 'teal' | 'purple';
  message?: string;
  className?: string;
}

const sizeMap = {
  sm: 'w-4 h-4 border',
  md: 'w-8 h-8 border-2',
  lg: 'w-12 h-12 border-3',
};

const colorMap = {
  blue: { border: 'var(--accent-blue)', top: 'transparent' },
  green: { border: 'var(--accent-green)', top: 'transparent' },
  red: { border: 'var(--accent-red)', top: 'transparent' },
  teal: { border: 'var(--accent-teal)', top: 'transparent' },
  purple: { border: 'var(--accent-purple)', top: 'transparent' },
};

export default function LoadingSpinner({
  size = 'md',
  color = 'blue',
  message,
  className = ''
}: LoadingSpinnerProps) {
  const colorStyle = colorMap[color];

  return (
    <div className={`flex flex-col items-center gap-3 ${className}`}>
      <div
        className={`${sizeMap[size]} rounded-full animate-spin`}
        style={{
          borderColor: colorStyle.border,
          borderTopColor: colorStyle.top,
        }}
      />
      {message && (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          {message}
        </p>
      )}
    </div>
  );
}

/**
 * Full-screen loading wrapper
 */
export function LoadingScreen({ message = 'Memuat...' }: { message?: string }) {
  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: 'var(--bg-primary)' }}
    >
      <LoadingSpinner message={message} />
    </div>
  );
}

/**
 * Centered loading within a container
 */
export function LoadingCenter({ message }: { message?: string }) {
  return (
    <div className="flex justify-center py-12">
      <LoadingSpinner message={message} />
    </div>
  );
}
