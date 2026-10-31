import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const staffData = [
    { name: 'Udin' },
    { name: 'Sari' },
  ];

  for (const s of staffData) {
    const existing = await prisma.staff.findFirst({ where: { name: s.name } });
    if (!existing) {
      await prisma.staff.create({ data: { name: s.name, isActive: true } });
      console.log('Berhasil menambahkan staff:', s.name);
    } else {
      console.log('Staff sudah ada:', s.name);
    }
  }

  const supplierData = [
    { name: 'Pak Haji', phone: '08123456789' },
    { name: 'Toko Grosir', phone: '08987654321' },
  ];

  for (const sup of supplierData) {
    const existing = await prisma.supplier.findFirst({ where: { name: sup.name } });
    if (!existing) {
      await prisma.supplier.create({
        data: { name: sup.name, phone: sup.phone, isActive: true },
      });
      console.log('Berhasil menambahkan supplier:', sup.name);
    } else {
      console.log('Supplier sudah ada:', sup.name);
    }
  }

  const suppliers = await prisma.supplier.findMany();
  const staff = await prisma.staff.findMany();
  console.log('Total suppliers:', suppliers.length);
  console.log('Total staff:', staff.length);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
