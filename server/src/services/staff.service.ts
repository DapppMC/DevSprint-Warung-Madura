import type { Staff } from '@prisma/client';
import { db } from '../lib/db';
import { ConflictError, NotFoundError } from '../lib/errors';
import { hasPrismaCode } from '../lib/prisma-errors';
import type { StaffDto } from '../types/dto';
import { FALLBACK_STAFF } from '../lib/fallback-data';

export interface CreateStaffInput {
  name: string;
  isActive?: boolean;
}

export interface UpdateStaffInput {
  name?: string;
  isActive?: boolean;
}

export function toStaffDto(staff: Staff): StaffDto {
  return {
    id: staff.id,
    name: staff.name,
    isActive: staff.isActive,
    createdAt: staff.createdAt.toISOString(),
  };
}

export async function listStaff(): Promise<StaffDto[]> {
  try {
    const staffList = await db.staff.findMany({
      orderBy: { name: 'asc' },
    });
    return staffList.map(toStaffDto);
  } catch (err) {
    console.warn(
      '[Staff] Database query failed, returning fallback staff:',
      (err as Error).message,
    );
    return [...FALLBACK_STAFF];
  }
}

export async function getStaff(id: string): Promise<StaffDto> {
  try {
    const staff = await db.staff.findUnique({ where: { id } });
    if (staff) return toStaffDto(staff);
  } catch (err) {
    console.warn(
      '[Staff] Database query failed during getStaff, checking fallback:',
      (err as Error).message,
    );
  }
  const fallback = FALLBACK_STAFF.find((s) => s.id === id);
  if (!fallback) throw new NotFoundError('Staff tidak ditemukan.');
  return fallback;
}

export async function createStaff(input: CreateStaffInput): Promise<StaffDto> {
  try {
    const staff = await db.staff.create({
      data: {
        name: input.name,
        isActive: input.isActive ?? true,
      },
    });
    return toStaffDto(staff);
  } catch (error) {
    if (hasPrismaCode(error, 'P2002')) {
      throw new ConflictError('Nama staff sudah digunakan.');
    }
    throw error;
  }
}

export async function updateStaff(id: string, input: UpdateStaffInput): Promise<StaffDto> {
  try {
    const staff = await db.staff.update({
      where: { id },
      data: input,
    });
    return toStaffDto(staff);
  } catch (error) {
    if (hasPrismaCode(error, 'P2025')) {
      throw new NotFoundError('Staff tidak ditemukan.');
    }
    if (hasPrismaCode(error, 'P2002')) {
      throw new ConflictError('Nama staff sudah digunakan.');
    }
    throw error;
  }
}
