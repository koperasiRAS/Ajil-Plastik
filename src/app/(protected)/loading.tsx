import { LoadingCenter } from '@/components/LoadingSpinner';

export default function Loading() {
  return (
    <div className="flex items-center justify-center p-6 h-full min-h-[50vh] w-full" style={{ background: 'var(--bg-primary)' }}>
      <LoadingCenter />
    </div>
  );
}
