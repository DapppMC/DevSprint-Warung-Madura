const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const bcrypt = require('bcryptjs');

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.log('[Migration] No DATABASE_URL found. Skipping migrations.');
    return;
  }

  // 1. Determine target schema
  let targetSchema = process.env.DB_SCHEMA || 'public';
  try {
    const parsed = new URL(databaseUrl);
    const schemaParam = parsed.searchParams.get('schema');
    if (schemaParam) {
      targetSchema = schemaParam;
    }
  } catch (err) {
    // ignore URL parse errors
  }

  console.log(`[Migration] Target database schema: "${targetSchema}"`);

  // 2. Connect via pg
  const isRemote = databaseUrl.includes('supabase.com') || databaseUrl.includes('neon.tech') || databaseUrl.includes('sslmode=require');
  const client = new Client({
    connectionString: databaseUrl,
    ssl: isRemote ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 10000,
  });

  await client.connect();

  try {
    // Set schema search path
    await client.query(`SET search_path TO "${targetSchema}", public;`);

    // Create tracking table
    await client.query(`
      CREATE TABLE IF NOT EXISTS "_applied_migrations" (
        "name" VARCHAR(255) PRIMARY KEY,
        "applied_at" TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Find migrations
    const candidates = [
      path.resolve(__dirname, '../prisma/migrations'),
      path.resolve(__dirname, '../../server/prisma/migrations'),
      path.resolve(process.cwd(), 'server/prisma/migrations'),
      path.resolve(process.cwd(), 'prisma/migrations'),
    ];
    const migrationsDir = candidates.find(p => fs.existsSync(p));

    if (migrationsDir) {
      const dirs = fs.readdirSync(migrationsDir)
        .filter(f => fs.statSync(path.join(migrationsDir, f)).isDirectory())
        .sort();

      for (const dir of dirs) {
        const check = await client.query(`SELECT name FROM "_applied_migrations" WHERE name = $1;`, [dir]);
        if (check.rows.length > 0) {
          continue;
        }

        const sqlPath = path.join(migrationsDir, dir, 'migration.sql');
        if (!fs.existsSync(sqlPath)) continue;

        const sql = fs.readFileSync(sqlPath, 'utf8');
        console.log(`[Migration] Applying ${dir}...`);
        await client.query(sql);
        await client.query(`INSERT INTO "_applied_migrations" (name) VALUES ($1);`, [dir]);
        console.log(`[Migration] ✓ Applied ${dir}`);
      }
    }

    // Check if initial users exist. If not, seed initial users & products
    const userCheck = await client.query(`SELECT COUNT(*) as count FROM "User";`);
    const count = parseInt(userCheck.rows[0].count, 10);
    if (count === 0) {
      console.log('[Migration] Database is empty. Seeding initial users and master data...');
      
      // Staff
      await client.query(`
        INSERT INTO "Staff" ("id", "name", "isActive", "createdAt", "updatedAt")
        VALUES 
          ('1882048b-3ab8-42f3-affe-b9506589b813', 'Udin', true, NOW(), NOW()),
          ('2882048b-3ab8-42f3-affe-b9506589b814', 'Sari', true, NOW(), NOW())
        ON CONFLICT ("id") DO NOTHING;
      `);

      // Users
      const hashOwner = await bcrypt.hash('123456', 10);
      const hashUdin = await bcrypt.hash('1111', 10);
      const hashSari = await bcrypt.hash('2222', 10);

      await client.query(`
        INSERT INTO "User" ("id", "username", "passwordHash", "name", "role", "staffId", "isActive", "createdAt", "updatedAt")
        VALUES
          (gen_random_uuid(), 'cakrofi', $1, 'Cak Rofi', 'PEMILIK', NULL, true, NOW(), NOW()),
          (gen_random_uuid(), 'udin', $2, 'Udin', 'STAF', '1882048b-3ab8-42f3-affe-b9506589b813', true, NOW(), NOW()),
          (gen_random_uuid(), 'sari', $3, 'Sari', 'STAF', '2882048b-3ab8-42f3-affe-b9506589b814', true, NOW(), NOW())
        ON CONFLICT ("username") DO NOTHING;
      `, [hashOwner, hashUdin, hashSari]);

      // Role Permissions
      const defaultOwnerPerms = [
        'stock:read', 'stock:adjust', 'goods_receipt:read', 'goods_receipt:create',
        'purchase_order:read', 'purchase_order:manage', 'product:read', 'product:manage',
        'cost:view', 'dashboard:financial', 'sales:manage', 'supplier:manage',
        'staff:manage', 'permission:manage'
      ];
      const defaultStaffPerms = [
        'stock:read', 'goods_receipt:read', 'goods_receipt:create',
        'purchase_order:read', 'product:read', 'sales:manage'
      ];

      for (const perm of defaultOwnerPerms) {
        await client.query(`
          INSERT INTO "RolePermission" ("id", "role", "permission", "createdAt")
          VALUES (gen_random_uuid(), 'PEMILIK', $1, NOW())
          ON CONFLICT DO NOTHING;
        `, [perm]);
      }
      for (const perm of defaultStaffPerms) {
        await client.query(`
          INSERT INTO "RolePermission" ("id", "role", "permission", "createdAt")
          VALUES (gen_random_uuid(), 'STAF', $1, NOW())
          ON CONFLICT DO NOTHING;
        `, [perm]);
      }

      // Products
      const products = [
        ['MIE-001', 'Indomie Goreng', 'Makanan Instan', 2800, 3500, 60, 'bungkus', 'dus', 40],
        ['MNM-001', 'Aqua 600 ml', 'Minuman', 2300, 3000, 48, 'botol', 'dus', 24],
        ['MNM-002', 'Teh Botol', 'Minuman', 3800, 5000, 24, 'pcs', 'pcs', 1],
        ['MNM-003', 'Kopi Sachet', 'Minuman', 1100, 1500, 40, 'sachet', 'renteng', 10],
        ['SMB-001', 'Minyak Goreng 1L', 'Sembako', 17500, 19500, 12, 'pcs', 'pcs', 1],
        ['SMB-002', 'Gula 1 kg', 'Sembako', 15500, 17500, 8, 'bungkus', 'bal', 20],
        ['RT-001', 'Sabun Mandi', 'Kebutuhan Rumah Tangga', 2800, 3500, 10, 'pcs', 'pcs', 1],
        ['SNK-001', 'Biskuit', 'Makanan Ringan', 6500, 8000, 20, 'pcs', 'pcs', 1],
        ['SMB-003', 'Beras 5 kg', 'Sembako', 62000, 68000, 3, 'pcs', 'pcs', 1],
        ['SMB-004', 'Garam Dapur', 'Sembako', 2500, 3500, 4, 'pcs', 'pcs', 1],
      ];

      for (const [sku, name, cat, purch, sell, stock, baseUnit, purchUnit, ratio] of products) {
        await client.query(`
          INSERT INTO "Product" ("id", "sku", "name", "category", "purchasePrice", "sellingPrice", "stock", "baseUnit", "purchaseUnit", "unitsPerPurchaseUnit", "isActive", "createdAt", "updatedAt")
          VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, true, NOW(), NOW())
          ON CONFLICT ("sku") DO NOTHING;
        `, [sku, name, cat, purch, sell, stock, baseUnit, purchUnit, ratio]);
      }

      // Suppliers
      await client.query(`
        INSERT INTO "Supplier" ("id", "name", "phone", "isActive", "createdAt", "updatedAt")
        VALUES 
          ('3882048b-3ab8-42f3-affe-b9506589b815', 'Pak Haji', '08123456789', true, NOW(), NOW()),
          ('4882048b-3ab8-42f3-affe-b9506589b816', 'Toko Grosir Berkah', '08987654321', true, NOW(), NOW())
        ON CONFLICT ("id") DO NOTHING;
      `);

      console.log('[Migration] ✓ Initial seed completed successfully.');
    } else {
      console.log(`[Migration] Database already populated (${count} users found).`);
    }

    // Check if initial Purchase Orders exist
    try {
      const poCheck = await client.query(`SELECT COUNT(*) as count FROM "PurchaseOrder";`);
      if (parseInt(poCheck.rows[0].count, 10) === 0) {
        console.log('[Migration] No Purchase Orders found. Seeding initial POs and GRs...');
        // Insert suppliers if not exist
        await client.query(`
          INSERT INTO "Supplier" ("id", "name", "phone", "isActive", "createdAt", "updatedAt")
          VALUES 
            ('3882048b-3ab8-42f3-affe-b9506589b815', 'Pak Haji', '08123456789', true, NOW(), NOW()),
            ('4882048b-3ab8-42f3-affe-b9506589b816', 'Toko Grosir Berkah', '08987654321', true, NOW(), NOW()),
            ('5882048b-3ab8-42f3-affe-b9506589b817', 'PT Indofood Sukses Makmur', '081122334455', true, NOW(), NOW()),
            ('6882048b-3ab8-42f3-affe-b9506589b818', 'PT Tirta Investama / Danone Aqua', '081199887766', true, NOW(), NOW())
          ON CONFLICT ("id") DO NOTHING;
        `);

        // Find product IDs
        const mieRes = await client.query(`SELECT id FROM "Product" WHERE "sku" = 'MIE-001' LIMIT 1;`);
        const aquaRes = await client.query(`SELECT id FROM "Product" WHERE "sku" = 'MNM-001' LIMIT 1;`);
        const minyakRes = await client.query(`SELECT id FROM "Product" WHERE "sku" = 'SMB-001' LIMIT 1;`);

        if (mieRes.rows[0] && aquaRes.rows[0] && minyakRes.rows[0]) {
          const mieId = mieRes.rows[0].id;
          const aquaId = aquaRes.rows[0].id;
          const minyakId = minyakRes.rows[0].id;

          // PO 1: OPEN
          const po1Id = 'a1111111-1111-1111-1111-111111111111';
          await client.query(`
            INSERT INTO "PurchaseOrder" ("id", "orderNumber", "supplierId", "orderedAt", "status", "note", "createdAt", "updatedAt")
            VALUES ($1, 'PO-202610-001', '5882048b-3ab8-42f3-affe-b9506589b817', NOW(), 'OPEN', 'Restock mingguan mie instan reguler', NOW(), NOW())
            ON CONFLICT ("orderNumber") DO NOTHING;
          `, [po1Id]);
          await client.query(`
            INSERT INTO "PurchaseOrderLine" ("id", "purchaseOrderId", "productId", "orderedBase", "fulfilledBase", "cancelledBase", "purchaseUnit", "unitsPerPurchaseUnit", "createdAt", "updatedAt")
            VALUES (gen_random_uuid(), $1, $2, 120, 0, 0, 'dus', 40, NOW(), NOW())
            ON CONFLICT DO NOTHING;
          `, [po1Id, mieId]);

          // PO 2: PARTIAL
          const po2Id = 'b2222222-2222-2222-2222-222222222222';
          await client.query(`
            INSERT INTO "PurchaseOrder" ("id", "orderNumber", "supplierId", "orderedAt", "status", "note", "createdAt", "updatedAt")
            VALUES ($1, 'PO-202610-002', '6882048b-3ab8-42f3-affe-b9506589b818', NOW(), 'PARTIAL', 'Pengadaan air mineral botol 600ml', NOW(), NOW())
            ON CONFLICT ("orderNumber") DO NOTHING;
          `, [po2Id]);
          const pol2Res = await client.query(`
            INSERT INTO "PurchaseOrderLine" ("id", "purchaseOrderId", "productId", "orderedBase", "fulfilledBase", "cancelledBase", "purchaseUnit", "unitsPerPurchaseUnit", "createdAt", "updatedAt")
            VALUES (gen_random_uuid(), $1, $2, 96, 48, 0, 'dus', 24, NOW(), NOW())
            RETURNING id;
          `, [po2Id, aquaId]);
          const pol2Id = pol2Res.rows[0]?.id;

          // GR 1 for PO 2
          const gr1Id = 'c3333333-3333-3333-3333-333333333333';
          await client.query(`
            INSERT INTO "GoodsReceipt" ("id", "receiptNumber", "idempotencyKey", "purchaseOrderId", "supplierId", "receivedById", "receivedAt", "note", "createdAt", "updatedAt")
            VALUES ($1, 'GR-202610-001', 'idemp-gr-init-001', $2, '6882048b-3ab8-42f3-affe-b9506589b818', '1882048b-3ab8-42f3-affe-b9506589b813', NOW(), 'Penerimaan tahap 1 (2 dus Aqua 600ml)', NOW(), NOW())
            ON CONFLICT ("receiptNumber") DO NOTHING;
          `, [gr1Id, po2Id]);
          if (pol2Id) {
            await client.query(`
              INSERT INTO "GoodsReceiptLine" ("id", "goodsReceiptId", "productId", "purchaseOrderLineId", "receivedBase", "rejectedBase", "bonusBase", "purchaseUnit", "unitsPerPurchaseUnit", "unitCostPerPurchaseUnit", "costPerBaseUnit", "effectiveCostPerBaseUnit", "createdAt", "updatedAt")
              VALUES (gen_random_uuid(), $1, $2, $3, 48, 0, 0, 'dus', 24, 55200, 2300, 2300, NOW(), NOW())
              ON CONFLICT DO NOTHING;
            `, [gr1Id, aquaId, pol2Id]);
          }

          // PO 3: COMPLETE
          const po3Id = 'd4444444-4444-4444-4444-444444444444';
          await client.query(`
            INSERT INTO "PurchaseOrder" ("id", "orderNumber", "supplierId", "orderedAt", "status", "note", "createdAt", "updatedAt")
            VALUES ($1, 'PO-202610-003', '4882048b-3ab8-42f3-affe-b9506589b816', NOW(), 'COMPLETE', 'Pengadaan sembako minyak goreng', NOW(), NOW())
            ON CONFLICT ("orderNumber") DO NOTHING;
          `, [po3Id]);
          await client.query(`
            INSERT INTO "PurchaseOrderLine" ("id", "purchaseOrderId", "productId", "orderedBase", "fulfilledBase", "cancelledBase", "purchaseUnit", "unitsPerPurchaseUnit", "createdAt", "updatedAt")
            VALUES (gen_random_uuid(), $1, $2, 24, 24, 0, 'pcs', 1, NOW(), NOW())
            ON CONFLICT DO NOTHING;
          `, [po3Id, minyakId]);

          // PO 4: CANCELLED
          const po4Id = 'e5555555-5555-5555-5555-555555555555';
          await client.query(`
            INSERT INTO "PurchaseOrder" ("id", "orderNumber", "supplierId", "orderedAt", "status", "cancelReason", "note", "createdAt", "updatedAt")
            VALUES ($1, 'PO-202610-004', '3882048b-3ab8-42f3-affe-b9506589b815', NOW(), 'CANCELLED', 'Supplier kehabisan stok varian kopi torabika', 'Pesanan biskuit & kopi', NOW(), NOW())
            ON CONFLICT ("orderNumber") DO NOTHING;
          `, [po4Id]);
          await client.query(`
            INSERT INTO "PurchaseOrderLine" ("id", "purchaseOrderId", "productId", "orderedBase", "fulfilledBase", "cancelledBase", "purchaseUnit", "unitsPerPurchaseUnit", "createdAt", "updatedAt")
            VALUES (gen_random_uuid(), $1, $2, 40, 0, 40, 'pcs', 1, NOW(), NOW())
            ON CONFLICT DO NOTHING;
          `, [po4Id, mieId]);

          console.log('[Migration] ✓ Initial Purchase Orders and Goods Receipts seeded successfully.');
        }
      }
    } catch (poErr) {
      console.warn('[Migration] PO seed note:', poErr.message);
    }

    console.log('[Migration] Database migration check completed successfully.');
  } finally {
    await client.end();
  }
}

main().catch(err => {
  console.error('[Migration] Failed:', err);
  process.exit(1);
});
