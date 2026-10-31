import { Prisma } from '@prisma/client';

// Prisma error codes used in this app:
//   P2002 unique constraint failed
//   P2003 foreign key constraint failed (e.g. deleting a product that is still referenced)
//   P2025 record to update/delete not found
export function hasPrismaCode(error: unknown, code: 'P2002' | 'P2003' | 'P2025'): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}
