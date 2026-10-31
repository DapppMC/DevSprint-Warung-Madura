import type { ReactNode } from 'react';
import { btnSecondary } from './ui';

export function LoadingState({ label = 'Memuat data...' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-12 text-sm text-slate-500 dark:text-slate-400">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 dark:border-slate-600 border-t-emerald-600" />
      {label}
    </div>
  );
}

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="rounded-md border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/40 p-6 text-center">
      <p className="text-sm font-medium text-red-800 dark:text-red-300">Gagal memuat data</p>
      <p className="mt-1 text-sm text-red-700 dark:text-red-400">{message}</p>
      {onRetry && (
        <button type="button" className={`${btnSecondary} mt-4`} onClick={onRetry}>
          Coba lagi
        </button>
      )}
    </div>
  );
}

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="px-6 py-12 text-center">
      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{title}</p>
      {description && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
