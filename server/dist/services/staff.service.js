"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toStaffDto = toStaffDto;
exports.listStaff = listStaff;
exports.getStaff = getStaff;
exports.createStaff = createStaff;
exports.updateStaff = updateStaff;
const db_1 = require("../lib/db");
const errors_1 = require("../lib/errors");
const prisma_errors_1 = require("../lib/prisma-errors");
const fallback_data_1 = require("../lib/fallback-data");
function toStaffDto(staff) {
    return {
        id: staff.id,
        name: staff.name,
        isActive: staff.isActive,
        createdAt: staff.createdAt.toISOString(),
    };
}
async function listStaff() {
    try {
        const staffList = await db_1.db.staff.findMany({
            orderBy: { name: 'asc' },
        });
        return staffList.map(toStaffDto);
    }
    catch (err) {
        console.warn('[Staff] Database query failed, returning fallback staff:', err.message);
        return [...fallback_data_1.FALLBACK_STAFF];
    }
}
async function getStaff(id) {
    try {
        const staff = await db_1.db.staff.findUnique({ where: { id } });
        if (staff)
            return toStaffDto(staff);
    }
    catch (err) {
        console.warn('[Staff] Database query failed during getStaff, checking fallback:', err.message);
    }
    const fallback = fallback_data_1.FALLBACK_STAFF.find((s) => s.id === id);
    if (!fallback)
        throw new errors_1.NotFoundError('Staff tidak ditemukan.');
    return fallback;
}
async function createStaff(input) {
    try {
        const staff = await db_1.db.staff.create({
            data: {
                name: input.name,
                isActive: input.isActive ?? true,
            },
        });
        return toStaffDto(staff);
    }
    catch (error) {
        if ((0, prisma_errors_1.hasPrismaCode)(error, 'P2002')) {
            throw new errors_1.ConflictError('Nama staff sudah digunakan.');
        }
        throw error;
    }
}
async function updateStaff(id, input) {
    try {
        const staff = await db_1.db.staff.update({
            where: { id },
            data: input,
        });
        return toStaffDto(staff);
    }
    catch (error) {
        if ((0, prisma_errors_1.hasPrismaCode)(error, 'P2025')) {
            throw new errors_1.NotFoundError('Staff tidak ditemukan.');
        }
        if ((0, prisma_errors_1.hasPrismaCode)(error, 'P2002')) {
            throw new errors_1.ConflictError('Nama staff sudah digunakan.');
        }
        throw error;
    }
}
