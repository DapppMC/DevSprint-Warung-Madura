import { useState } from 'react';
import { getErrorMessage } from '../api/http';
import { createStaff } from '../api/staff';
import { Modal } from './Modal';
import { useToast } from './ToastProvider';
import { btnPrimary, btnSecondary, inputClass, labelClass } from './ui';
import type { Staff } from '../types/api';

interface StaffFormModalProps {
  onClose: () => void;
  onSuccess: (staff: Staff) => void;
}

export function StaffFormModal({ onClose, onSuccess }: StaffFormModalProps) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Nama staff wajib diisi');
      return;
    }

    setSubmitting(true);
    try {
      const created = await createStaff({
        name: trimmedName,
      });
      toast.success(`Staff "${created.name}" berhasil ditambahkan.`);
      onSuccess(created);
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title="Tambah Staff Penerima Baru" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={labelClass} htmlFor="staff-name">
            Nama Staff <span className="text-red-500">*</span>
          </label>
          <input
            id="staff-name"
            className={inputClass}
            placeholder="mis. Cak Rofi / Udin / Sari"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
            maxLength={100}
          />
        </div>

        {error && (
          <div className="rounded-md bg-red-50 dark:bg-red-950/40 p-3 text-sm text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900/50">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            className={btnSecondary}
            onClick={onClose}
            disabled={submitting}
          >
            Batal
          </button>
          <button
            type="submit"
            className={btnPrimary}
            disabled={submitting}
          >
            {submitting ? 'Menyimpan...' : 'Simpan Staff'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
