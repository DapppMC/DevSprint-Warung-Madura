"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toSupplierDto = toSupplierDto;
exports.listSuppliers = listSuppliers;
exports.getSupplier = getSupplier;
exports.createSupplier = createSupplier;
exports.updateSupplier = updateSupplier;
const db_1 = require("../lib/db");
const errors_1 = require("../lib/errors");
const prisma_errors_1 = require("../lib/prisma-errors");
const fallback_data_1 = require("../lib/fallback-data");
function toSupplierDto(supplier) {
    return {
        id: supplier.id,
        name: supplier.name,
        phone: supplier.phone,
        isActive: supplier.isActive,
        createdAt: supplier.createdAt.toISOString(),
    };
}
async function listSuppliers() {
    try {
        const suppliers = await db_1.db.supplier.findMany({
            orderBy: { name: 'asc' },
        });
        return suppliers.map(toSupplierDto);
    }
    catch (err) {
        console.warn('[Supplier] Database query failed, returning fallback suppliers:', err.message);
        return [...fallback_data_1.FALLBACK_SUPPLIERS];
    }
}
async function getSupplier(id) {
    try {
        const supplier = await db_1.db.supplier.findUnique({ where: { id } });
        if (supplier)
            return toSupplierDto(supplier);
    }
    catch (err) {
        console.warn('[Supplier] Database query failed during getSupplier, checking fallback:', err.message);
    }
    const fallback = fallback_data_1.FALLBACK_SUPPLIERS.find((s) => s.id === id);
    if (!fallback)
        throw new errors_1.NotFoundError('Supplier tidak ditemukan.');
    return fallback;
}
async function createSupplier(input) {
    try {
        const supplier = await db_1.db.supplier.create({
            data: {
                name: input.name,
                phone: input.phone ?? null,
                isActive: input.isActive ?? true,
            },
        });
        return toSupplierDto(supplier);
    }
    catch (error) {
        if ((0, prisma_errors_1.hasPrismaCode)(error, 'P2002')) {
            throw new errors_1.ConflictError('Nama supplier sudah digunakan.');
        }
        throw error;
    }
}
async function updateSupplier(id, input) {
    try {
        const supplier = await db_1.db.supplier.update({
            where: { id },
            data: input,
        });
        return toSupplierDto(supplier);
    }
    catch (error) {
        if ((0, prisma_errors_1.hasPrismaCode)(error, 'P2025')) {
            throw new errors_1.NotFoundError('Supplier tidak ditemukan.');
        }
        if ((0, prisma_errors_1.hasPrismaCode)(error, 'P2002')) {
            throw new errors_1.ConflictError('Nama supplier sudah digunakan.');
        }
        throw error;
    }
}
