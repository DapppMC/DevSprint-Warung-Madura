"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hasPrismaCode = hasPrismaCode;
const client_1 = require("@prisma/client");
// Prisma error codes used in this app:
//   P2002 unique constraint failed
//   P2003 foreign key constraint failed (e.g. deleting a product that is still referenced)
//   P2025 record to update/delete not found
function hasPrismaCode(error, code) {
    return error instanceof client_1.Prisma.PrismaClientKnownRequestError && error.code === code;
}
