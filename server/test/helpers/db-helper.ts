import { PrismaClient, type Product, type Staff, type Supplier, type User, type Role } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';
import { hashPassword, generateToken } from '../../src/lib/auth-crypto';
import { DEFAULT_ROLE_PERMISSIONS } from '../../src/services/permission.service';

// Pastikan .env.test dimuat dengan override: true
dotenv.config({ path: path.resolve(__dirname, '../../.env.test'), override: true });

// Guard ketat: pastikan database yang digunakan benar-benar berakhiran _test
export function assertTestDatabase(): void {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error('DATABASE_URL tidak disetel!');
  }
  const url = new URL(dbUrl);
  const dbName = url.pathname.replace(/^\//, '');
  if (!dbName.endsWith('_test')) {
    throw new Error(
      `PERINGATAN KEAMANAN: Database "${dbName}" tidak berakhiran "_test"! Test DITOLAK demi mencegah kerusakan data asli.`,
    );
  }
}

// Jalankan guard saat modul dimuat
assertTestDatabase();

export const testDb = new PrismaClient();

export async function resetTestDatabase(): Promise<void> {
  assertTestDatabase();

  await testDb.$transaction(async (tx) => {
    // Urutan penghapusan sesuai relasi foreign key
    await tx.message.deleteMany();
    await tx.conversationMember.deleteMany();
    await tx.conversation.deleteMany();
    await tx.catalogItem.deleteMany();
    await tx.business.deleteMany();
    await tx.scraperRun.deleteMany();
    await tx.rolePermission.deleteMany();
    await tx.user.deleteMany();
    await tx.goodsReceiptLine.deleteMany();
    await tx.goodsReceipt.deleteMany();
    await tx.purchaseOrderLine.deleteMany();
    await tx.purchaseOrder.deleteMany();
    await tx.staff.deleteMany();
    await tx.supplier.deleteMany();
    await tx.saleItem.deleteMany();
    await tx.stockMovement.deleteMany();
    await tx.sale.deleteMany();
    await tx.product.deleteMany();
  });
}

export interface TestMasterData {
  indomie: Product;
  kopi: Product;
  aqua: Product;
  gula: Product;
  udin: Staff;
  sari: Staff;
  pakHaji: Supplier;
  tokoGrosir: Supplier;
  cakRofiUser: User;
  udinUser: User;
  sariUser: User;
  ownerToken: string;
  udinToken: string;
  sariToken: string;
}

export async function seedTestMasterData(): Promise<TestMasterData> {
  assertTestDatabase();

  const ownerPinHash = await hashPassword('123456');
  const udinPinHash = await hashPassword('1111');
  const sariPinHash = await hashPassword('2222');

  return await testDb.$transaction(async (tx) => {
    const indomie = await tx.product.create({
      data: {
        sku: 'MIE-001',
        name: 'Indomie Goreng',
        category: 'Makanan Instan',
        purchasePrice: 2800,
        sellingPrice: 3500,
        stock: 0,
        isActive: true,
        baseUnit: 'bungkus',
        purchaseUnit: 'dus',
        unitsPerPurchaseUnit: 40,
      },
    });

    const kopi = await tx.product.create({
      data: {
        sku: 'MNM-003',
        name: 'Kopi Sachet',
        category: 'Minuman',
        purchasePrice: 1100,
        sellingPrice: 1500,
        stock: 0,
        isActive: true,
        baseUnit: 'sachet',
        purchaseUnit: 'renteng',
        unitsPerPurchaseUnit: 10,
      },
    });

    const aqua = await tx.product.create({
      data: {
        sku: 'MNM-001',
        name: 'Aqua 600ml',
        category: 'Minuman',
        purchasePrice: 3000,
        sellingPrice: 4000,
        stock: 0,
        isActive: true,
        baseUnit: 'botol',
        purchaseUnit: 'karton',
        unitsPerPurchaseUnit: 24,
      },
    });

    const gula = await tx.product.create({
      data: {
        sku: 'SMB-002',
        name: 'Gula 1 kg',
        category: 'Sembako',
        purchasePrice: 15500,
        sellingPrice: 17500,
        stock: 0,
        isActive: true,
        baseUnit: 'bungkus',
        purchaseUnit: 'bal',
        unitsPerPurchaseUnit: 20,
      },
    });

    const udin = await tx.staff.create({
      data: { name: 'Udin', isActive: true },
    });

    const sari = await tx.staff.create({
      data: { name: 'Sari', isActive: true },
    });

    const pakHaji = await tx.supplier.create({
      data: { name: 'Pak Haji', isActive: true },
    });

    const tokoGrosir = await tx.supplier.create({
      data: { name: 'Toko Grosir', isActive: true },
    });

    const cakRofiUser = await tx.user.create({
      data: {
        username: 'cakrofi',
        name: 'Cak Rofi',
        passwordHash: ownerPinHash,
        role: 'PEMILIK',
        isActive: true,
      },
    });

    const udinUser = await tx.user.create({
      data: {
        username: 'udin',
        name: 'Udin',
        passwordHash: udinPinHash,
        role: 'STAF',
        staffId: udin.id,
        isActive: true,
      },
    });

    const sariUser = await tx.user.create({
      data: {
        username: 'sari',
        name: 'Sari',
        passwordHash: sariPinHash,
        role: 'STAF',
        staffId: sari.id,
        isActive: true,
      },
    });

    const entries: Array<{ role: Role; permission: string }> = [];
    for (const [role, perms] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
      for (const perm of perms) {
        entries.push({ role: role as Role, permission: perm });
      }
    }
    await tx.rolePermission.createMany({
      data: entries,
      skipDuplicates: true,
    });

    const ownerToken = generateToken({
      userId: cakRofiUser.id,
      username: cakRofiUser.username,
      role: cakRofiUser.role,
      staffId: null,
    });

    const udinToken = generateToken({
      userId: udinUser.id,
      username: udinUser.username,
      role: udinUser.role,
      staffId: udin.id,
    });

    const sariToken = generateToken({
      userId: sariUser.id,
      username: sariUser.username,
      role: sariUser.role,
      staffId: sari.id,
    });

    return {
      indomie,
      kopi,
      aqua,
      gula,
      udin,
      sari,
      pakHaji,
      tokoGrosir,
      cakRofiUser,
      udinUser,
      sariUser,
      ownerToken,
      udinToken,
      sariToken,
    };
  });
}
