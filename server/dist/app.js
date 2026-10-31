"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const express_1 = __importDefault(require("express"));
const auth_1 = require("./middleware/auth");
const error_handler_1 = require("./middleware/error-handler");
const routes_1 = require("./routes");
exports.app = (0, express_1.default)();
exports.app.set('trust proxy', true);
exports.app.use(express_1.default.json());
exports.app.use(auth_1.authenticate);
exports.app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
});
exports.app.use('/api', routes_1.apiRouter);
exports.app.use('/api', (_req, res) => {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Endpoint tidak ditemukan.' } });
});
// Serve frontend SPA in production if built
const clientDistCandidates = [
    path_1.default.resolve(__dirname, '../../client/dist'),
    path_1.default.resolve(__dirname, '../client/dist'),
    path_1.default.resolve(process.cwd(), 'client/dist'),
    path_1.default.resolve(process.cwd(), '../client/dist'),
];
const clientDistPath = clientDistCandidates.find((p) => fs_1.default.existsSync(p));
if (clientDistPath) {
    exports.app.use(express_1.default.static(clientDistPath));
    exports.app.use((req, res, next) => {
        if (req.method === 'GET' && !req.path.startsWith('/api')) {
            res.sendFile(path_1.default.join(clientDistPath, 'index.html'));
        }
        else {
            next();
        }
    });
}
exports.app.use(error_handler_1.errorHandler);
