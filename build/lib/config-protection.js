"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PROTECTED_CONFIG_KEYS = void 0;
exports.createConfigBackup = createConfigBackup;
exports.parseConfigBackup = parseConfigBackup;
exports.isSuspiciousConfigReplacement = isSuspiciousConfigReplacement;
exports.restoreProtectedConfig = restoreProtectedConfig;
exports.PROTECTED_CONFIG_KEYS = ['markets', 'routes', 'products', 'productGroups', 'lists', 'reviewItems'];
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function rows(value) { return Array.isArray(value) ? value : []; }
function createConfigBackup(native, savedAt = new Date().toISOString()) {
    const protectedNative = {};
    for (const key of exports.PROTECTED_CONFIG_KEYS)
        protectedNative[key] = clone(rows(native[key]));
    return { version: 1, savedAt, native: protectedNative };
}
function parseConfigBackup(value) {
    try {
        const parsed = typeof value === 'string' ? JSON.parse(value) : value;
        if (!parsed || typeof parsed !== 'object' || parsed.version !== 1)
            return null;
        const native = parsed.native;
        if (!native || typeof native !== 'object')
            return null;
        return { version: 1, savedAt: String(parsed.savedAt || ''), native: clone(native) };
    }
    catch {
        return null;
    }
}
function isSuspiciousConfigReplacement(current, backup) {
    const core = ['markets', 'routes', 'products', 'productGroups'];
    let collapsed = 0;
    for (const key of core) {
        const before = rows(backup.native[key]).length;
        const now = rows(current[key]).length;
        if (before >= 5 && now < before && now <= Math.floor(before * 0.6))
            collapsed++;
    }
    return collapsed >= 2;
}
function restoreProtectedConfig(current, backup) {
    if (!isSuspiciousConfigReplacement(current, backup))
        return clone(current);
    const restored = clone(current);
    for (const key of exports.PROTECTED_CONFIG_KEYS)
        restored[key] = clone(rows(backup.native[key]));
    return restored;
}
