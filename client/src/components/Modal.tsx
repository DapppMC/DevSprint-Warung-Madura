import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
  headerAction?: ReactNode;
}

export function Modal({
  title,
  subtitle,
  onClose,
  children,
  size = 'md',
  headerAction,
}: ModalProps) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-xl',
    xl: 'max-w-2xl',
    '2xl': 'max-w-4xl',
    '3xl': 'max-w-5xl',
  }[size];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-black/75 p-4 backdrop-blur-xs transition-opacity animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`max-h-[92vh] w-full ${sizeClasses} flex flex-col rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden transform transition-transform duration-100 ease-out animate-in zoom-in-95 duration-150 text-slate-800 dark:text-slate-200`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200/90 dark:border-slate-800 px-6 py-4 bg-slate-50/70 dark:bg-slate-800/90">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">{title}</h2>
            {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-2">
            {headerAction}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/80 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition-transform duration-100 ease-out cursor-pointer"
              title="Tutup (Esc)"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto px-6 py-5 flex-1">{children}</div>
      </div>
    </div>
  );
}
