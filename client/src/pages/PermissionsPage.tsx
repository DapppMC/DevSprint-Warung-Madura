import { useEffect, useState } from 'react';
import {
  Check,
  RotateCcw,
  Save,
  Download,
  AlertTriangle,
  Lock,
} from 'lucide-react';
import { getPermissionsMatrix, updateRolePermissions } from '../api/auth';
import { PageHeader } from '../components/PageHeader';
import { ErrorState, LoadingState } from '../components/StateViews';
import {
  btnPrimary,
  btnSecondary,
  tableContainerClass,
  tableHeadClass,
  tdClass,
  thStickyClass,
} from '../components/ui';
import { downloadCsv } from '../lib/export';
import { useAuth } from '../lib/AuthContext';
import type { PermissionDefinition, RolePermissionsMatrix } from '../types/api';

export function PermissionsPage() {
  const { isOwner, refreshUser } = useAuth();
  const [data, setData] = useState<RolePermissionsMatrix | null>(null);
  const [staffPermissions, setStaffPermissions] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await getPermissionsMatrix();
      setData(res);
      const staffPerms = res.roles?.STAF || res.matrix?.STAF || [];
      setStaffPermissions(new Set(staffPerms));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat matriks izin.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleToggleStaff = (permissionId: string) => {
    if (!isOwner) return;
    setStaffPermissions((prev) => {
      const next = new Set(prev);
      if (next.has(permissionId)) {
        next.delete(permissionId);
      } else {
        next.add(permissionId);
      }
      return next;
    });
    setSuccessMessage(null);
  };

  const handleSave = async () => {
    if (!isOwner) return;
    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);
    try {
      await updateRolePermissions('STAF', Array.from(staffPermissions));
      setSuccessMessage('Matriks izin Staf berhasil diperbarui dan disimpan permanen di database!');
      await refreshUser();
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan perubahan hak akses.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetToDefault = () => {
    if (!data) return;
    const defaultStaff = [
      'stock:read',
      'goods_receipt:read',
      'goods_receipt:create',
      'purchase_order:read',
      'product:read',
      'sales:manage',
    ];
    setStaffPermissions(new Set(defaultStaff));
    setSuccessMessage('Izin Staf direset ke konfigurasi default (belum disimpan ke server).');
  };

  const handleExportMatrixCsv = () => {
    if (!data) return;
    const defs = data.definitions || data.permissions || [];
    const headers = ['Kategori', 'Kode Izin', 'Label', 'Deskripsi', 'Pemilik', 'Staf'];
    const rows = defs.map((d) => [
      d.category,
      d.id,
      d.label,
      d.description,
      'AKTIF (LOCKED)',
      staffPermissions.has(d.id) ? 'DIIZINKAN' : 'DILARANG',
    ]);
    downloadCsv(`matriks_rbac_warung_madura_${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
  };

  if (isLoading) return <LoadingState label="Memuat matriks perizinan enterprise..." />;
  if (error && !data) return <ErrorState message={error} onRetry={loadData} />;
  if (!data) return null;

  const definitions: PermissionDefinition[] = data.definitions || data.permissions || [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Granular Dynamic RBAC Matrix"
        description="Konfigurasi izin dinamis multi-role. Perubahan tersimpan atomik pada tabel RolePermission dan berlaku instan pada REST API & Frontend Guard."
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportMatrixCsv}
              className={btnSecondary}
              title="Unduh Matriks Hak Akses (CSV)"
            >
              <Download className="h-4 w-4" /> Unduh Dokumen (CSV)
            </button>
            {isOwner && (
              <>
                <button
                  type="button"
                  onClick={handleResetToDefault}
                  className={btnSecondary}
                  title="Kembalikan ke Default Kontrak"
                >
                  <RotateCcw className="h-4 w-4" /> Reset Default
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving}
                  className={btnPrimary}
                >
                  <Save className="h-4 w-4" /> {isSaving ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
              </>
            )}
          </div>
        }
      />

      {!isOwner && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-800/80 bg-amber-50 dark:bg-amber-950/40 p-4 text-xs text-amber-800 dark:text-amber-200 flex items-center gap-3 shadow-xs">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
          <div>
            <p className="font-bold">Mode Tinjau Akses (Read-Only)</p>
            <p className="text-amber-700 dark:text-amber-300 mt-0.5">
              Anda masuk sebagai Staf. Matriks hak akses hanya dapat diubah dan disimpan oleh Pemilik Toko (Role: PEMILIK).
            </p>
          </div>
        </div>
      )}

      {successMessage && (
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-800/80 bg-emerald-50 dark:bg-emerald-950/40 p-4 text-xs font-bold text-emerald-800 dark:text-emerald-200 flex items-center gap-2 shadow-xs">
          <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          <span>{successMessage}</span>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-rose-200 dark:border-rose-800/80 bg-rose-50 dark:bg-rose-950/40 p-4 text-xs text-rose-800 dark:text-rose-200 flex items-center gap-2 shadow-xs">
          <AlertTriangle className="h-4 w-4 text-rose-600 dark:text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Matrix Table with Sticky Header position: sticky; top: 0; z-index: 20 */}
      <div className={tableContainerClass}>
        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 border-separate border-spacing-0">
          <thead className={tableHeadClass}>
            <tr>
              <th className={thStickyClass}>Kategori</th>
              <th className={thStickyClass}>Kode Izin & Nama Fungsional</th>
              <th className={thStickyClass}>Dampak Proteksi & Masking</th>
              <th className={`${thStickyClass} text-center w-36`}>Role: PEMILIK</th>
              <th className={`${thStickyClass} text-center w-36`}>Role: STAF</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 bg-white dark:bg-slate-900/60 text-xs">
            {definitions.map((def) => {
              const isStaffAllowed = staffPermissions.has(def.id);
              const isCostOrFinancial = def.id === 'cost:view' || def.id === 'dashboard:financial';

              return (
                <tr
                  key={def.id}
                  className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-transform duration-100 ease-out ${
                    isCostOrFinancial ? 'bg-amber-50/20 dark:bg-amber-950/20' : ''
                  }`}
                >
                  <td className={`${tdClass} font-semibold text-slate-700 dark:text-slate-300`}>
                    <span className="rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[11px] font-bold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                      {def.category}
                    </span>
                  </td>
                  <td className={tdClass}>
                    <div className="font-bold text-slate-900 dark:text-slate-100 text-sm flex items-center gap-1.5">
                      {def.label}
                      {isCostOrFinancial && (
                        <span className="rounded bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-800/60 px-1.5 py-0.2 text-[10px] font-extrabold uppercase">
                          Sensitif
                        </span>
                      )}
                    </div>
                    <code className="text-[11px] font-mono text-slate-400 dark:text-slate-500">{def.id}</code>
                  </td>
                  <td className={`${tdClass} text-slate-600 dark:text-slate-300 max-w-sm`}>
                    {def.description}
                  </td>
                  <td className={`${tdClass} text-center`}>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 text-xs font-bold text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                      <Lock className="h-3 w-3" /> Selalu Aktif
                    </span>
                  </td>
                  <td className={`${tdClass} text-center`}>
                    <label className="inline-flex cursor-pointer items-center justify-center">
                      <input
                        type="checkbox"
                        className="h-5 w-5 rounded-md border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-emerald-600 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-50 transition-transform duration-100 ease-out cursor-pointer"
                        checked={isStaffAllowed}
                        disabled={!isOwner || isSaving}
                        onChange={() => handleToggleStaff(def.id)}
                      />
                    </label>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {isOwner && (
        <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Perubahan hak akses staf langsung mempengaruhi menu navigasi dan data masking saat disimpan.
          </p>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className={btnPrimary}
          >
            <Save className="h-4 w-4" /> {isSaving ? 'Menyimpan...' : 'Simpan Matriks Sekarang'}
          </button>
        </div>
      )}
    </div>
  );
}
