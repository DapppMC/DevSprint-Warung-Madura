import { useState } from 'react';
import { getErrorMessage } from '../api/http';
import { createSupplier } from '../api/suppliers';
import { Modal } from './Modal';
import { useToast } from './ToastProvider';
import { btnPrimary, btnSecondary, inputClass, labelClass } from './ui';
import type { Supplier } from '../types/api';

interface SupplierFormModalProps {
  onClose: () => void;
  onSuccess: (supplier: Supplier) => void;
}

export function SupplierFormModal({ onClose, onSuccess }: SupplierFormModalProps) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Nama supplier wajib diisi');
      return;
    }

    setSubmitting(true);
    try {
      const created = await createSupplier({
        name: trimmedName,
        phone: phone.trim() || undefined,
      });
      toast.success(`Supplier "${created.name}" berhasil ditambahkan.`);
      onSuccess(created);
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title="Tambah Supplier Baru" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={labelClass} htmlFor="supplier-name">
            Nama Supplier <span className="text-red-500">*</span>
          </label>
          <input
            id="supplier-name"
            className={inputClass}
            placeholder="mis. Toko Grosir Jaya / Pak Haji Slamet"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
            maxLength={100}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="supplier-phone">
            Nomor Telepon / WhatsApp (Opsional)
          </label>
          <input
            id="supplier-phone"
            type="tel"
            className={inputClass}
            placeholder="mis. 081234567890"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            maxLength={30}
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
            {submitting ? 'Menyimpan...' : 'Simpan Supplier'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
