import { Modal } from './Modal';
import { btnDanger, btnSecondary } from './ui';

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

// Shown before any destructive action.
export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal title={title} onClose={onCancel}>
      <p className="text-sm text-slate-600 dark:text-slate-300">{message}</p>
      <div className="mt-6 flex justify-end gap-2">
        <button type="button" className={btnSecondary} onClick={onCancel} disabled={busy}>
          Batal
        </button>
        <button type="button" className={btnDanger} onClick={onConfirm} disabled={busy}>
          {busy ? 'Memproses...' : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
