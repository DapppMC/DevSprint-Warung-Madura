"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.idParamSchema = void 0;
const zod_1 = require("zod");
const UUID_OR_SLUG_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$|^[a-zA-Z0-9_-]{2,64}$/i;
exports.idParamSchema = zod_1.z.object({
    id: zod_1.z
        .string()
        .trim()
        .min(1, 'ID tidak boleh kosong')
        .refine((val) => UUID_OR_SLUG_REGEX.test(val), { message: 'ID tidak valid' }),
});
