export const PROTECTED_CONFIG_KEYS = ['markets','routes','products','productGroups','lists','reviewItems'] as const;
export type ProtectedConfigKey = typeof PROTECTED_CONFIG_KEYS[number];
export type NativeConfig = Record<string, unknown>;
export interface ConfigBackup { version: 1; savedAt: string; native: NativeConfig; }

function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }
function rows(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }

export function createConfigBackup(native: NativeConfig, savedAt = new Date().toISOString()): ConfigBackup {
    const protectedNative: NativeConfig = {};
    for (const key of PROTECTED_CONFIG_KEYS) protectedNative[key] = clone(rows(native[key]));
    return { version: 1, savedAt, native: protectedNative };
}

export function parseConfigBackup(value: unknown): ConfigBackup | null {
    try {
        const parsed = typeof value === 'string' ? JSON.parse(value) : value;
        if (!parsed || typeof parsed !== 'object' || (parsed as ConfigBackup).version !== 1) return null;
        const native = (parsed as ConfigBackup).native;
        if (!native || typeof native !== 'object') return null;
        return { version: 1, savedAt: String((parsed as ConfigBackup).savedAt || ''), native: clone(native) };
    } catch { return null; }
}

export function isSuspiciousConfigReplacement(current: NativeConfig, backup: ConfigBackup): boolean {
    const core: ProtectedConfigKey[] = ['markets','routes','products','productGroups'];
    let collapsed = 0;
    for (const key of core) {
        const before = rows(backup.native[key]).length;
        const now = rows(current[key]).length;
        if (before >= 5 && now < before && now <= Math.floor(before * 0.6)) collapsed++;
    }
    return collapsed >= 2;
}

export function restoreProtectedConfig(current: NativeConfig, backup: ConfigBackup): NativeConfig {
    if (!isSuspiciousConfigReplacement(current, backup)) return clone(current);
    const restored = clone(current);
    for (const key of PROTECTED_CONFIG_KEYS) restored[key] = clone(rows(backup.native[key]));
    return restored;
}
