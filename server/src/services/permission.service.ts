import { db } from '../lib/db';
import type { Role } from '@prisma/client';

export interface PermissionDefinition {
  id: string;
  label: string;
  category: string;
  description: string;
}

export const ALL_PERMISSIONS: PermissionDefinition[] = [
  { id: 'stock:read', label: 'Lihat Stok & Riwayat', category: 'Stok', description: 'Melihat sisa stok dan riwayat pergerakan stok' },
  { id: 'stock:adjust', label: 'Koreksi Stok Manual', category: 'Stok', description: 'Melakukan penyesuaian stok keluar/masuk' },
  { id: 'goods_receipt:read', label: 'Lihat Riwayat Penerimaan', category: 'Barang Masuk', description: 'Melihat daftar dan detail nota penerimaan barang' },
  { id: 'goods_receipt:create', label: 'Terima Barang Masuk', category: 'Barang Masuk', description: 'Mencatat penerimaan fisik barang dari supplier' },
  { id: 'purchase_order:read', label: 'Lihat Pesanan (PO)', category: 'Pesanan', description: 'Melihat daftar dan status pesanan barang' },
  { id: 'purchase_order:manage', label: 'Buat & Tutup Pesanan (PO)', category: 'Pesanan', description: 'Membuat PO baru dan membatalkan sisa pesanan' },
  { id: 'product:read', label: 'Lihat Katalog Produk', category: 'Produk', description: 'Melihat daftar produk aktif dan nonaktif' },
  { id: 'product:manage', label: 'Kelola Master Produk & Harga', category: 'Produk', description: 'Menambah, mengubah harga jual/beli, dan menghapus produk' },
  { id: 'cost:view', label: 'Lihat Harga Modal', category: 'Finansial', description: 'Melihat harga modal kulakan dan harga dasar per unit' },
  { id: 'dashboard:financial', label: 'Lihat Omset di Dashboard', category: 'Finansial', description: 'Melihat total penjualan hari ini dan daftar invoice' },
  { id: 'sales:manage', label: 'Transaksi Penjualan Kasir', category: 'Penjualan', description: 'Membuat transaksi kasir dan melihat detail struk' },
  { id: 'supplier:manage', label: 'Kelola Supplier', category: 'Master', description: 'Menambah dan mengubah data supplier grosir' },
  { id: 'staff:manage', label: 'Kelola Akun Staf', category: 'Master', description: 'Menambah, mengubah, dan menonaktifkan akun staf' },
  { id: 'permission:manage', label: 'Kelola Matriks Izin Role', category: 'Sistem', description: 'Mengatur hak akses dan permission setiap role' },
];

export const DEFAULT_ROLE_PERMISSIONS: Record<Role, string[]> = {
  PEMILIK: ALL_PERMISSIONS.map((p) => p.id),
  STAF: [
    'stock:read',
    'goods_receipt:read',
    'goods_receipt:create',
    'purchase_order:read',
    'product:read',
    'sales:manage',
  ],
};

export async function ensureDefaultPermissions(): Promise<void> {
  try {
    const count = await db.rolePermission.count();
    if (count > 0) return;

    const entries: Array<{ role: Role; permission: string }> = [];
    for (const [role, perms] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
      for (const perm of perms) {
        entries.push({ role: role as Role, permission: perm });
      }
    }

    await db.rolePermission.createMany({
      data: entries,
      skipDuplicates: true,
    });
  } catch (err) {
    console.warn(
      '[Permission] Database unavailable during ensureDefaultPermissions, using in-memory defaults:',
      (err as Error).message,
    );
  }
}

export async function getRolePermissions(role: Role): Promise<string[]> {
  try {
    await ensureDefaultPermissions();
    const rows = await db.rolePermission.findMany({
      where: { role },
      select: { permission: true },
    });
    if (rows && rows.length > 0) {
      return rows.map((r) => r.permission);
    }
  } catch (err) {
    console.warn(
      '[Permission] Database error in getRolePermissions, fallback to default:',
      (err as Error).message,
    );
  }
  return DEFAULT_ROLE_PERMISSIONS[role] || [];
}

export async function getPermissionsMatrix(): Promise<{
  permissions: PermissionDefinition[];
  definitions: PermissionDefinition[];
  matrix: Record<Role, string[]>;
  roles: Record<Role, string[]>;
}> {
  try {
    await ensureDefaultPermissions();
    const rows = await db.rolePermission.findMany({
      select: { role: true, permission: true },
    });

    const matrix: Record<Role, string[]> = {
      PEMILIK: [],
      STAF: [],
    };

    for (const row of rows) {
      if (matrix[row.role]) {
        matrix[row.role].push(row.permission);
      }
    }

    if (matrix.PEMILIK.length === 0 && matrix.STAF.length === 0) {
      return {
        permissions: ALL_PERMISSIONS,
        definitions: ALL_PERMISSIONS,
        matrix: { ...DEFAULT_ROLE_PERMISSIONS },
        roles: { ...DEFAULT_ROLE_PERMISSIONS },
      };
    }

    return {
      permissions: ALL_PERMISSIONS,
      definitions: ALL_PERMISSIONS,
      matrix,
      roles: matrix,
    };
  } catch (err) {
    console.warn(
      '[Permission] Database error in getPermissionsMatrix, fallback to default:',
      (err as Error).message,
    );
    return {
      permissions: ALL_PERMISSIONS,
      definitions: ALL_PERMISSIONS,
      matrix: { ...DEFAULT_ROLE_PERMISSIONS },
      roles: { ...DEFAULT_ROLE_PERMISSIONS },
    };
  }
}

export async function updateRolePermissions(
  role: Role,
  permissions: string[],
): Promise<string[]> {
  // Validasi: hanya id permission yang dikenal yang disimpan
  const validPermissions = ALL_PERMISSIONS.map((p) => p.id);
  const filtered = permissions.filter((p) => validPermissions.includes(p));

  await db.$transaction(async (tx) => {
    await tx.rolePermission.deleteMany({ where: { role } });
    if (filtered.length > 0) {
      await tx.rolePermission.createMany({
        data: filtered.map((permission) => ({ role, permission })),
        skipDuplicates: true,
      });
    }
  });

  return getRolePermissions(role);
}

export async function hasPermission(role: Role, permissionId: string): Promise<boolean> {
  if (role === 'PEMILIK') return true; // Pemilik selalu memiliki akses superadmin penuh
  const perms = await getRolePermissions(role);
  return perms.includes(permissionId);
}
