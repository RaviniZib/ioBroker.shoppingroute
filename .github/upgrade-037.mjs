import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const write = (rel, content) => {
    const target = path.join(root, rel);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
};
const json = rel => JSON.parse(read(rel));
const writeJson = (rel, value) => write(rel, `${JSON.stringify(value, null, 2)}\n`);
const replaceOnce = (text, search, replacement, label) => {
    const first = text.indexOf(search);
    if (first < 0) throw new Error(`Upgrade anchor not found: ${label}`);
    if (text.indexOf(search, first + search.length) >= 0) throw new Error(`Upgrade anchor is not unique: ${label}`);
    return text.slice(0, first) + replacement + text.slice(first + search.length);
};

// -----------------------------------------------------------------------------
// Version metadata
// -----------------------------------------------------------------------------
const pkg = json('package.json');
pkg.version = '0.3.7';
writeJson('package.json', pkg);

const lock = json('package-lock.json');
lock.version = '0.3.7';
if (lock.packages?.['']) lock.packages[''].version = '0.3.7';
writeJson('package-lock.json', lock);

const ioPackage = json('io-package.json');
ioPackage.common.version = '0.3.7';
ioPackage.common.news = {
    '0.3.7': {
        en: 'Adds an interactive Admin shopping list with drag-and-drop/manual movement between markets, persistent per-item manual overrides, responsive Admin improvements, and a retained “accepted” review status after normal Save.',
        de: 'Ergänzt eine interaktive Einkaufsliste im Admin mit Drag&Drop/manuellem Verschieben zwischen Märkten, dauerhaften manuellen Artikel-Overrides, Responsive-Verbesserungen und einem erhaltenen Status „Übernommen“ nach normalem Speichern.',
        ru: 'Добавлен интерактивный список покупок в Admin с перетаскиванием и ручным перемещением между магазинами, постоянными ручными настройками элементов, улучшенной адаптивностью и сохранением статуса «принято» после обычного сохранения.',
        pt: 'Adiciona uma lista de compras interativa no Admin com arrastar e soltar/movimento manual entre mercados, substituições manuais persistentes por item, melhorias responsivas e estado “aceite” mantido após guardar normalmente.',
        nl: 'Voegt een interactieve boodschappenlijst in Admin toe met slepen/handmatig verplaatsen tussen winkels, blijvende handmatige overrides per artikel, responsieve verbeteringen en een behouden status “overgenomen” na normaal opslaan.',
        fr: 'Ajoute une liste de courses interactive dans Admin avec glisser-déposer/déplacement manuel entre magasins, des priorités manuelles persistantes par article, des améliorations responsive et un statut « accepté » conservé après un enregistrement normal.',
        it: 'Aggiunge una lista della spesa interattiva in Admin con drag&drop/spostamento manuale tra negozi, override manuali persistenti per articolo, miglioramenti responsive e stato “accettato” mantenuto dopo il normale salvataggio.',
        es: 'Añade una lista de compra interactiva en Admin con arrastrar y soltar/movimiento manual entre tiendas, ajustes manuales persistentes por artículo, mejoras responsivas y un estado «aceptado» conservado tras guardar normalmente.',
        pl: 'Dodaje interaktywną listę zakupów w Adminie z przeciąganiem/ręcznym przenoszeniem między sklepami, trwałymi ręcznymi nadpisaniami pozycji, poprawkami responsywności oraz zachowanym statusem „zaakceptowano” po zwykłym zapisie.',
        uk: 'Додано інтерактивний список покупок в Admin із перетягуванням і ручним переміщенням між магазинами, постійними ручними налаштуваннями елементів, покращеною адаптивністю та збереженням статусу «прийнято» після звичайного збереження.',
        'zh-cn': '新增 Admin 交互式购物清单，可拖放/手动在商店之间移动商品，保存逐项手动覆盖，改进响应式布局，并在普通保存后保留“已接受”状态。',
    },
    ...ioPackage.common.news,
};
if (!ioPackage.instanceObjects.some(obj => obj._id === 'info.manualOverrides')) {
    ioPackage.instanceObjects.push({
        _id: 'info.manualOverrides',
        type: 'state',
        common: {
            name: 'Manual shopping-list item overrides',
            type: 'string',
            role: 'json',
            read: true,
            write: false,
            def: '[]',
        },
        native: {},
    });
}
writeJson('io-package.json', ioPackage);

// -----------------------------------------------------------------------------
// Persistent manual item layout model
// -----------------------------------------------------------------------------
write('src/lib/manual-order.ts', `import type { AlexaListItem } from './model';

export interface ManualItemOverride {
    listName: string;
    itemId: string;
    originalText: string;
    market: string;
    position: number;
    updatedAt: string;
}

export interface ManualMove {
    listName: string;
    itemId: string;
    originalText: string;
    fromMarket: string;
    fromPosition: number;
    toMarket: string;
    toPosition: number;
}

const PREFIX = /^(?:\\d{2}>|\\[\\d{2}\\])\\s+(.+)$/s;
const norm = (value: unknown): string => String(value || '').trim().toLocaleLowerCase('de');
const visibleText = (value: unknown): string => {
    const text = String(value || '').trim();
    return text.match(PREFIX)?.[1]?.trim() || text;
};

export function normalizeManualOverrides(value: unknown): ManualItemOverride[] {
    if (!Array.isArray(value)) return [];
    const result: ManualItemOverride[] = [];
    const seen = new Set<string>();
    for (const entry of value) {
        if (!entry || typeof entry !== 'object') continue;
        const raw = entry as Record<string, unknown>;
        const listName = String(raw.listName || '').trim();
        const itemId = String(raw.itemId || '').trim();
        const originalText = String(raw.originalText || '').trim();
        const market = String(raw.market || '').trim();
        const position = Math.max(0, Math.min(98, Math.floor(Number(raw.position) || 0)));
        if (!listName || !itemId || !originalText || !market) continue;
        const key = norm(listName) + '\\u0000' + itemId;
        if (seen.has(key)) continue;
        seen.add(key);
        result.push({
            listName,
            itemId,
            originalText,
            market,
            position,
            updatedAt: String(raw.updatedAt || '') || new Date(0).toISOString(),
        });
    }
    return result;
}

export function overridesForList(overrides: ManualItemOverride[], listName: string): ManualItemOverride[] {
    const wanted = norm(listName);
    return normalizeManualOverrides(overrides).filter(entry => norm(entry.listName) === wanted);
}

export function clearManualOverridesForList(overrides: ManualItemOverride[], listName: string): ManualItemOverride[] {
    const wanted = norm(listName);
    return normalizeManualOverrides(overrides).filter(entry => norm(entry.listName) !== wanted);
}

export function reconcileManualOverrides(
    overrides: ManualItemOverride[],
    listName: string,
    items: AlexaListItem[],
): ManualItemOverride[] {
    const wanted = norm(listName);
    const other = normalizeManualOverrides(overrides).filter(entry => norm(entry.listName) !== wanted);
    const current = items
        .filter(item => item && item.completed === false && item.id && visibleText(item.value))
        .map(item => ({ id: String(item.id), text: visibleText(item.value) }));
    const byId = new Map(current.map(item => [item.id, item]));
    const byText = new Map<string, Array<{ id: string; text: string }>>();
    for (const item of current) {
        const key = norm(item.text);
        const list = byText.get(key) || [];
        list.push(item);
        byText.set(key, list);
    }

    const resolved: ManualItemOverride[] = [];
    const usedIds = new Set<string>();
    for (const entry of overridesForList(overrides, listName)) {
        let match = byId.get(entry.itemId);
        if (!match) {
            const candidates = byText.get(norm(entry.originalText)) || [];
            if (candidates.length === 1) match = candidates[0];
        }
        if (!match || usedIds.has(match.id)) continue;
        usedIds.add(match.id);
        resolved.push({ ...entry, itemId: match.id, originalText: match.text });
    }
    return other.concat(resolved);
}

export function moveManualOverride(overrides: ManualItemOverride[], move: ManualMove): ManualItemOverride[] {
    const all = normalizeManualOverrides(overrides);
    const listKey = norm(move.listName);
    const fromKey = norm(move.fromMarket);
    const toKey = norm(move.toMarket);
    const fromPosition = Math.max(0, Math.floor(Number(move.fromPosition) || 0));
    const toPosition = Math.max(0, Math.floor(Number(move.toPosition) || 0));

    const shifted = all
        .filter(entry => !(norm(entry.listName) === listKey && entry.itemId === move.itemId))
        .map(entry => {
            if (norm(entry.listName) !== listKey) return entry;
            const marketKey = norm(entry.market);
            let position = entry.position;
            if (fromKey === toKey && marketKey === fromKey) {
                if (fromPosition < toPosition && position > fromPosition && position <= toPosition) position -= 1;
                else if (toPosition < fromPosition && position >= toPosition && position < fromPosition) position += 1;
            } else {
                if (marketKey === fromKey && position > fromPosition) position -= 1;
                if (marketKey === toKey && position >= toPosition) position += 1;
            }
            return position === entry.position ? entry : { ...entry, position };
        });

    shifted.push({
        listName: move.listName,
        itemId: move.itemId,
        originalText: move.originalText,
        market: move.toMarket,
        position: toPosition,
        updatedAt: new Date().toISOString(),
    });
    return normalizeManualOverrides(shifted);
}
`);

// -----------------------------------------------------------------------------
// Prefix planner: manual market/position overrides win over automatic sorting
// -----------------------------------------------------------------------------
let prefix = read('src/lib/prefix-sort.ts');
prefix = replaceOnce(
    prefix,
    "import { formatMarketHeader, marketNameFromHeader, optimizeMarketAssignments } from './market-plan';\n",
    "import { formatMarketHeader, marketNameFromHeader, optimizeMarketAssignments } from './market-plan';\nimport { overridesForList, type ManualItemOverride } from './manual-order';\n",
    'prefix manual-order import',
);
prefix = replaceOnce(
    prefix,
    ' * @param marketHeaders Whether market headers belong in the route.\n */\nexport function buildPrefixTargets(',
    ' * @param marketHeaders Whether market headers belong in the route.\n * @param manualOverrides Current per-item manual Admin overrides.\n * @param listName Managed list name used to scope overrides.\n */\nexport function buildPrefixTargets(',
    'prefix JSDoc',
);
prefix = replaceOnce(
    prefix,
    '    minimumItemsPerMarket = 1,\n    marketHeaders = false,\n): PrefixTarget[] {',
    '    minimumItemsPerMarket = 1,\n    marketHeaders = false,\n    manualOverrides: ManualItemOverride[] = [],\n    listName = \'\',\n): PrefixTarget[] {',
    'prefix signature',
);
const plannerOld = `    const assigned = optimizeMarketAssignments(
        real,
        markets,
        products,
        fallbackMarket,
        priorityMarket,
        minimumItemsPerMarket,
    ).map(entry => ({
        ...entry,
        marketOrder: marketOrder(markets, entry.parsed.market),
        categoryOrder: categoryOrder(routes, entry.parsed.market, entry.parsed.category),
    })).sort((left, right) => {
        if (left.marketOrder !== right.marketOrder) return left.marketOrder - right.marketOrder;
        if (left.categoryOrder !== right.categoryOrder) return left.categoryOrder - right.categoryOrder;
        const category = left.parsed.category.localeCompare(right.parsed.category, 'de', { sensitivity: 'base' });
        if (category !== 0 && left.categoryOrder === 9999 && right.categoryOrder === 9999) return category;
        const product = left.parsed.productName.localeCompare(right.parsed.productName, 'de', { sensitivity: 'base' });
        if (product !== 0) return product;
        return String(left.source.id).localeCompare(String(right.source.id));
    });`;
const plannerNew = `    const manualById = new Map(overridesForList(manualOverrides, listName).map(entry => [entry.itemId, entry]));
    const automaticallyAssigned = optimizeMarketAssignments(
        real,
        markets,
        products,
        fallbackMarket,
        priorityMarket,
        minimumItemsPerMarket,
    ).map(entry => {
        const manual = manualById.get(String(entry.source.id));
        const parsed = manual?.market ? { ...entry.parsed, market: manual.market } : entry.parsed;
        return {
            ...entry,
            parsed,
            manualPosition: manual?.position,
            marketOrder: marketOrder(markets, parsed.market),
            categoryOrder: categoryOrder(routes, parsed.market, parsed.category),
        };
    }).sort((left, right) => {
        if (left.marketOrder !== right.marketOrder) return left.marketOrder - right.marketOrder;
        if (left.categoryOrder !== right.categoryOrder) return left.categoryOrder - right.categoryOrder;
        const category = left.parsed.category.localeCompare(right.parsed.category, 'de', { sensitivity: 'base' });
        if (category !== 0 && left.categoryOrder === 9999 && right.categoryOrder === 9999) return category;
        const product = left.parsed.productName.localeCompare(right.parsed.productName, 'de', { sensitivity: 'base' });
        if (product !== 0) return product;
        return String(left.source.id).localeCompare(String(right.source.id));
    });

    const marketKeys: string[] = [];
    const grouped = new Map<string, typeof automaticallyAssigned>();
    for (const entry of automaticallyAssigned) {
        const key = normalize(entry.parsed.market);
        if (!grouped.has(key)) marketKeys.push(key);
        const group = grouped.get(key) || [];
        group.push(entry);
        grouped.set(key, group);
    }
    const assigned = marketKeys.flatMap(key => {
        const group = grouped.get(key) || [];
        const manual = group
            .filter(entry => Number.isInteger(entry.manualPosition))
            .sort((a, b) => Number(a.manualPosition) - Number(b.manualPosition) || String(a.source.id).localeCompare(String(b.source.id)));
        const ordered = group.filter(entry => !Number.isInteger(entry.manualPosition));
        for (const entry of manual) {
            const position = Math.max(0, Math.min(ordered.length, Number(entry.manualPosition)));
            ordered.splice(position, 0, entry);
        }
        return ordered;
    });`;
prefix = replaceOnce(prefix, plannerOld, plannerNew, 'prefix automatic planner');
write('src/lib/prefix-sort.ts', prefix);

// -----------------------------------------------------------------------------
// Review status: accepted rows remain visible as an idempotent status entry
// -----------------------------------------------------------------------------
let model = read('src/lib/model.ts');
model = replaceOnce(
    model,
    "export type ReviewAction = 'pending' | 'accept' | 'ignore';",
    "export type ReviewAction = 'pending' | 'accept' | 'accepted' | 'ignore';",
    'ReviewAction accepted state',
);
write('src/lib/model.ts', model);

let sorter = read('src/lib/sorter.ts');
sorter = replaceOnce(
    sorter,
    `        if (review.action !== 'accept') {
            remaining.push({ ...review });
            continue;
        }
`,
    `        if (review.action === 'accepted') {
            remaining.push({ ...review });
            continue;
        }
        if (review.action !== 'accept') {
            remaining.push({ ...review });
            continue;
        }
`,
    'review accepted guard',
);
sorter = replaceOnce(
    sorter,
    `            accepted.push({ ...existing });
            continue;
`,
    `            accepted.push({ ...existing });
            remaining.push({ ...review, action: 'accepted' });
            continue;
`,
    'review existing accepted status',
);
sorter = replaceOnce(
    sorter,
    `        merged.push(product);
        accepted.push(product);
`,
    `        merged.push(product);
        accepted.push(product);
        remaining.push({ ...review, action: 'accepted' });
`,
    'review new accepted status',
);
write('src/lib/sorter.ts', sorter);

// -----------------------------------------------------------------------------
// Runtime: list API + persistent override state + immediate confirmed moves
// -----------------------------------------------------------------------------
let main = read('src/main.ts');
main = replaceOnce(main, "const VERSION = '0.3.6';", "const VERSION = '0.3.7';", 'runtime version');
main = replaceOnce(
    main,
    "import { markAllReviewItemsAccept } from './lib/review-tools';\n",
    "import { markAllReviewItemsAccept } from './lib/review-tools';\nimport {\n    clearManualOverridesForList,\n    moveManualOverride,\n    normalizeManualOverrides,\n    overridesForList,\n    reconcileManualOverrides,\n    type ManualItemOverride,\n} from './lib/manual-order';\n",
    'main manual-order import',
);
main = replaceOnce(
    main,
    '    buildPrefixTargets,\n    createPrefixSortPlan,\n    expectedValues,\n    stripSortPrefix,',
    '    buildPrefixTargets,\n    createPrefixSortPlan,\n    expectedValues,\n    parseSortPrefix,\n    stripSortPrefix,',
    'main parseSortPrefix import',
);
main = replaceOnce(
    main,
    `interface DirectApplyJournal {
    version: 2;
    listName: string;
    listId: string;
    startedAt: string;
    status: 'applying' | 'failed';
    expectedValues: string[];
    deletedIds: string[];
    updatesConfirmed: number;
    deletesConfirmed: number;
    batchCreateConfirmed: boolean;
}
`,
    `interface DirectApplyJournal {
    version: 2;
    listName: string;
    listId: string;
    startedAt: string;
    status: 'applying' | 'failed';
    expectedValues: string[];
    deletedIds: string[];
    updatesConfirmed: number;
    deletesConfirmed: number;
    batchCreateConfirmed: boolean;
}

interface ShoppingListViewItem {
    id: string;
    text: string;
    market: string;
    category: string;
    position: number;
    manual: boolean;
}

interface ShoppingListView {
    listName: string;
    lists: string[];
    markets: string[];
    items: ShoppingListViewItem[];
    dryRun: boolean;
}
`,
    'shopping list view interfaces',
);
main = replaceOnce(
    main,
    '    private runtimeRoutes: RouteConfig[] = [];\n',
    '    private runtimeRoutes: RouteConfig[] = [];\n    private manualOverrides: ManualItemOverride[] = [];\n',
    'main manual override field',
);
main = replaceOnce(
    main,
    '        await this.loadTrafficMetrics();\n        await this.loadStatistics();\n',
    '        await this.loadTrafficMetrics();\n        await this.loadStatistics();\n        await this.loadManualOverrides();\n',
    'load manual overrides',
);
const shoppingMethods = `
    private configuredListName(requested: unknown): string {
        const value = String(requested || '').trim();
        const matched = this.listConfigs.find(list => list.name === value);
        return matched?.name || this.listConfigs[0]?.name || '';
    }

    private async buildShoppingListView(listName: string, confirmedOrder = false): Promise<ShoppingListView> {
        const resolvedList = this.configuredListName(listName);
        if (!resolvedList) throw new Error('No managed Alexa shopping list is configured.');
        const listId = await this.directListId(resolvedList);
        const snapshot = await this.readDirectItems(listId);
        const reconciled = reconcileManualOverrides(this.manualOverrides, resolvedList, snapshot);
        if (JSON.stringify(reconciled) !== JSON.stringify(this.manualOverrides)) {
            this.manualOverrides = reconciled;
            await this.persistManualOverrides();
        }
        const desired = buildPrefixTargets(
            snapshot,
            this.markets,
            this.routes,
            this.products,
            this.fallbackMarket,
            this.priorityMarketForList(resolvedList),
            this.minimumItemsPerMarket,
            this.marketHeadersEnabled,
            this.manualOverrides,
            resolvedList,
        );
        let visible = desired.filter(target => target.id && !isMarketHeader(target.originalText, this.markets));
        if (confirmedOrder) {
            visible = [...visible].sort((a, b) => {
                const left = a.currentPrefix ?? parseSortPrefix(a.currentValue || '')?.number ?? 999;
                const right = b.currentPrefix ?? parseSortPrefix(b.currentValue || '')?.number ?? 999;
                return left - right || String(a.id).localeCompare(String(b.id));
            });
        }
        const manualIds = new Set(overridesForList(this.manualOverrides, resolvedList).map(entry => entry.itemId));
        const positions = new Map<string, number>();
        const items = visible.map(target => {
            const market = target.market || this.fallbackMarket;
            const key = market.toLocaleLowerCase('de');
            const position = positions.get(key) || 0;
            positions.set(key, position + 1);
            return {
                id: String(target.id),
                text: stripSortPrefix(target.originalText),
                market,
                category: target.category,
                position,
                manual: manualIds.has(String(target.id)),
            };
        });
        const markets = this.markets.map(market => market.name);
        if (!markets.some(market => market.toLocaleLowerCase('de') === this.fallbackMarket.toLocaleLowerCase('de'))) {
            markets.push(this.fallbackMarket);
        }
        return {
            listName: resolvedList,
            lists: this.listConfigs.map(list => list.name),
            markets,
            items,
            dryRun: this.dryRun,
        };
    }

    private prepareImmediateApply(listName: string): void {
        const state = this.getListState(listName);
        if (state.timer) {
            this.clearTimeout(state.timer);
            state.timer = undefined;
        }
        const now = Date.now();
        state.phase = 'COLLECTING';
        state.firstEventAt = now;
        state.lastExternalAt = now;
        state.requestedAt = now;
        state.externalDirty = false;
        state.newIds.clear();
    }

    private async applyManualMove(message: any): Promise<{ ok: boolean; error?: string; view: ShoppingListView }> {
        const listName = this.configuredListName(message?.listName);
        const before = await this.buildShoppingListView(listName);
        if (this.dryRun) return { ok: false, error: 'Dry Run is active. Disable Dry Run before changing the Alexa list.', view: before };
        if (!(await this.isEnabled())) return { ok: false, error: 'ShoppingRoute is disabled.', view: before };
        if (this.applyingListName) return { ok: false, error: 'A shopping-list update is already running. Please try again.', view: before };
        const itemId = String(message?.itemId || '').trim();
        const item = before.items.find(entry => entry.id === itemId);
        if (!item) return { ok: false, error: 'The selected shopping-list item no longer exists.', view: before };
        const targetMarket = String(message?.targetMarket || '').trim();
        if (!before.markets.some(market => market.toLocaleLowerCase('de') === targetMarket.toLocaleLowerCase('de'))) {
            return { ok: false, error: 'The selected target market is not available.', view: before };
        }
        const targetCount = before.items.filter(entry => entry.market === targetMarket && entry.id !== itemId).length;
        const targetPosition = Math.max(0, Math.min(targetCount, Math.floor(Number(message?.targetPosition) || 0)));
        const previous = this.manualOverrides.map(entry => ({ ...entry }));
        this.manualOverrides = moveManualOverride(this.manualOverrides, {
            listName,
            itemId,
            originalText: item.text,
            fromMarket: item.market,
            fromPosition: item.position,
            toMarket: targetMarket,
            toPosition: targetPosition,
        });
        await this.persistManualOverrides();
        await this.setStateAsync('info.lastError', '', true);
        this.prepareImmediateApply(listName);
        await this.startApply(listName);
        const error = String((await this.getStateAsync('info.lastError'))?.val || '');
        if (error) {
            this.manualOverrides = previous;
            await this.persistManualOverrides();
            return { ok: false, error, view: await this.buildShoppingListView(listName, true) };
        }
        return { ok: true, view: await this.buildShoppingListView(listName) };
    }

    private async clearManualShoppingOrder(message: any): Promise<{ ok: boolean; error?: string; view: ShoppingListView }> {
        const listName = this.configuredListName(message?.listName);
        const before = await this.buildShoppingListView(listName);
        if (this.dryRun) return { ok: false, error: 'Dry Run is active. Disable Dry Run before changing the Alexa list.', view: before };
        if (!(await this.isEnabled())) return { ok: false, error: 'ShoppingRoute is disabled.', view: before };
        if (this.applyingListName) return { ok: false, error: 'A shopping-list update is already running. Please try again.', view: before };
        const previous = this.manualOverrides.map(entry => ({ ...entry }));
        this.manualOverrides = clearManualOverridesForList(this.manualOverrides, listName);
        await this.persistManualOverrides();
        await this.setStateAsync('info.lastError', '', true);
        this.prepareImmediateApply(listName);
        await this.startApply(listName);
        const error = String((await this.getStateAsync('info.lastError'))?.val || '');
        if (error) {
            this.manualOverrides = previous;
            await this.persistManualOverrides();
            return { ok: false, error, view: await this.buildShoppingListView(listName, true) };
        }
        return { ok: true, view: await this.buildShoppingListView(listName) };
    }

`;
main = replaceOnce(main, '    private async onMessage(obj: { command: string; from: string; callback?: any; message?: any }): Promise<void> {\n', shoppingMethods + `    private async onMessage(obj: { command: string; from: string; callback?: any; message?: any }): Promise<void> {
`, 'shopping list runtime methods');
main = replaceOnce(
    main,
    `        if (!obj?.callback) return;
        if (obj.command === 'markAllReviewItemsAccept') {`,
    `        if (!obj?.callback) return;
        if (obj.command === 'getShoppingList') {
            try { this.sendTo(obj.from, obj.command, await this.buildShoppingListView(this.configuredListName(obj.message?.listName)), obj.callback); }
            catch (error) { this.sendTo(obj.from, obj.command, { error: error instanceof Error ? error.message : String(error) }, obj.callback); }
            return;
        }
        if (obj.command === 'moveShoppingItem') {
            try { this.sendTo(obj.from, obj.command, await this.applyManualMove(obj.message), obj.callback); }
            catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                this.sendTo(obj.from, obj.command, { ok: false, error: message, view: await this.buildShoppingListView(this.configuredListName(obj.message?.listName), true) }, obj.callback);
            }
            return;
        }
        if (obj.command === 'clearManualShoppingOrder') {
            try { this.sendTo(obj.from, obj.command, await this.clearManualShoppingOrder(obj.message), obj.callback); }
            catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                this.sendTo(obj.from, obj.command, { ok: false, error: message, view: await this.buildShoppingListView(this.configuredListName(obj.message?.listName), true) }, obj.callback);
            }
            return;
        }
        if (obj.command === 'markAllReviewItemsAccept') {`,
    'shopping list message handlers',
);
main = replaceOnce(
    main,
    `        const desired = buildPrefixTargets(
            snapshot,
            this.markets,
            this.routes,
            this.products,
            this.fallbackMarket,
            priority,
            this.minimumItemsPerMarket,
            this.marketHeadersEnabled,
        );`,
    `        const reconciledOverrides = reconcileManualOverrides(this.manualOverrides, listName, snapshot);
        if (JSON.stringify(reconciledOverrides) !== JSON.stringify(this.manualOverrides)) {
            this.manualOverrides = reconciledOverrides;
            await this.persistManualOverrides();
        }
        const desired = buildPrefixTargets(
            snapshot,
            this.markets,
            this.routes,
            this.products,
            this.fallbackMarket,
            priority,
            this.minimumItemsPerMarket,
            this.marketHeadersEnabled,
            this.manualOverrides,
            listName,
        );`,
    'manual overrides in direct plan',
);
main = replaceOnce(
    main,
    `        const verification = verifyPrefixResult(verifiedItems, plan, state.externalDirty);
        if (!verification.ok) throw new Error(\`${'${listName}'}: direct final verification failed: ${'${englishRuntimeError(verification.reason || \'Unknown verification error.\')}'}\`);
        await this.clearDirectJournal();`,
    `        const verification = verifyPrefixResult(verifiedItems, plan, state.externalDirty);
        if (!verification.ok) throw new Error(\`${'${listName}'}: direct final verification failed: ${'${englishRuntimeError(verification.reason || \'Unknown verification error.\')}'}\`);
        const reboundOverrides = reconcileManualOverrides(this.manualOverrides, listName, verifiedItems);
        if (JSON.stringify(reboundOverrides) !== JSON.stringify(this.manualOverrides)) {
            this.manualOverrides = reboundOverrides;
            await this.persistManualOverrides();
        }
        await this.clearDirectJournal();`,
    'rebind manual overrides after direct apply',
);
const manualPersistence = `
    private async loadManualOverrides(): Promise<void> {
        try {
            const state = await this.getStateAsync('info.manualOverrides');
            const raw = state && typeof state.val === 'string' && state.val.trim() ? JSON.parse(state.val) : [];
            this.manualOverrides = normalizeManualOverrides(raw);
        } catch {
            this.manualOverrides = [];
        }
        await this.persistManualOverrides();
    }

    private async persistManualOverrides(): Promise<void> {
        this.manualOverrides = normalizeManualOverrides(this.manualOverrides);
        await this.setStateAsync('info.manualOverrides', JSON.stringify(this.manualOverrides, null, 2), true);
    }

`;
main = replaceOnce(main, '    private async loadTrafficMetrics(): Promise<void> {\n', manualPersistence + '    private async loadTrafficMetrics(): Promise<void> {\n', 'manual override persistence methods');
write('src/main.ts', main);

// -----------------------------------------------------------------------------
// Responsive route editor
// -----------------------------------------------------------------------------
let routeEditor = read('src-admin/route-editor.js');
routeEditor = replaceOnce(
    routeEditor,
    "const h = React.createElement;\n",
    `const h = React.createElement;
const routeResponsiveStyles = \`
    .shoppingroute-route-row {
        display: grid;
        grid-template-columns: 48px minmax(160px, 1fr) 144px;
    }
    .shoppingroute-route-actions {
        display: flex;
        justify-content: flex-end;
        gap: 6px;
    }
    @media (max-width: 600px) {
        .shoppingroute-route-row {
            grid-template-columns: 32px minmax(0, 1fr);
        }
        .shoppingroute-route-actions {
            grid-column: 2;
            justify-content: flex-start;
            flex-wrap: wrap;
        }
    }
\`;
`,
    'route responsive styles',
);
routeEditor = replaceOnce(
    routeEditor,
    `        const controlStyle = {
            minWidth: '240px',
            padding: '9px 12px',`,
    `        const controlStyle = {
            minWidth: 0,
            width: '100%',
            maxWidth: '320px',
            boxSizing: 'border-box',
            padding: '9px 12px',`,
    'route responsive control',
);
routeEditor = replaceOnce(
    routeEditor,
    `        const children = [
            h(
                'div',`,
    `        const children = [
            h('style', { key: 'responsive-styles' }, routeResponsiveStyles),
            h(
                'div',`,
    'route style element',
);
routeEditor = replaceOnce(
    routeEditor,
    `                                style: {
                                    display: 'grid',
                                    gridTemplateColumns: '48px minmax(160px, 1fr) 144px',
                                    alignItems: 'center',`,
    `                                className: 'shoppingroute-route-row',
                                style: {
                                    alignItems: 'center',`,
    'route row grid',
);
routeEditor = replaceOnce(
    routeEditor,
    `                                        key: 'buttons',
                                        style: { display: 'flex', justifyContent: 'flex-end', gap: '6px' },`,
    `                                        key: 'buttons',
                                        className: 'shoppingroute-route-actions',`,
    'route actions responsive class',
);
write('src-admin/route-editor.js', routeEditor);

// -----------------------------------------------------------------------------
// Interactive shopping-list Admin component
// -----------------------------------------------------------------------------
write('src-admin/shopping-list-editor-components.mjs', `import shoppingListEditor from './shopping-list-editor.js';

export default shoppingListEditor.Components;
`);

write('src-admin/shopping-list-editor.js', `'use strict';

/* eslint-disable jsdoc/require-jsdoc */

const React = require('react');
const h = React.createElement;

const text = (de, en) => {
    const language = typeof navigator !== 'undefined' ? String(navigator.language || '').toLowerCase() : 'de';
    return language.startsWith('de') ? de : en;
};

const responsiveStyles = \`
    .shoppingroute-list-toolbar {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        align-items: center;
        margin-bottom: 14px;
    }
    .shoppingroute-list-toolbar select,
    .shoppingroute-list-toolbar button,
    .shoppingroute-card select {
        min-height: 38px;
        box-sizing: border-box;
    }
    .shoppingroute-market-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 12px;
        align-items: start;
    }
    .shoppingroute-market-column {
        min-width: 0;
        border: 1px solid currentColor;
        border-radius: 8px;
        padding: 10px;
        opacity: 0.94;
    }
    .shoppingroute-card {
        border: 1px solid currentColor;
        border-radius: 6px;
        padding: 9px;
        margin: 8px 0;
        background: rgba(127, 127, 127, 0.08);
        cursor: grab;
    }
    .shoppingroute-card-controls {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 8px;
        align-items: center;
    }
    .shoppingroute-card-controls select {
        min-width: 0;
        flex: 1 1 130px;
    }
    .shoppingroute-list-button {
        min-width: 38px;
        min-height: 34px;
        border: 1px solid currentColor;
        border-radius: 4px;
        background: transparent;
        color: inherit;
        cursor: pointer;
    }
    .shoppingroute-list-button:disabled {
        cursor: default;
        opacity: 0.4;
    }
    @media (max-width: 600px) {
        .shoppingroute-market-grid {
            grid-template-columns: 1fr;
        }
        .shoppingroute-list-toolbar > * {
            width: 100%;
            max-width: none;
        }
        .shoppingroute-card {
            cursor: default;
        }
    }
\`;

class ShoppingListEditor extends React.Component {
    constructor(props) {
        super(props);
        this.state = { view: null, loading: true, busy: '', error: '' };
    }

    componentDidMount() {
        void this.load();
    }

    instanceName() {
        const adapter = String(this.props.adapterName || 'shoppingroute');
        const instance = Number.isFinite(Number(this.props.instance)) ? Number(this.props.instance) : 0;
        return adapter + '.' + instance;
    }

    async send(command, message) {
        if (!this.props.socket?.sendTo) throw new Error('Admin socket is unavailable.');
        return this.props.socket.sendTo(this.instanceName(), command, message || {});
    }

    async load(listName) {
        this.setState({ loading: true, error: '' });
        try {
            const result = await this.send('getShoppingList', { listName });
            if (!result || result.error) throw new Error(result?.error || 'Shopping list could not be loaded.');
            this.setState({ view: result, loading: false, busy: '' });
        } catch (error) {
            this.setState({ loading: false, busy: '', error: error instanceof Error ? error.message : String(error) });
        }
    }

    async move(itemId, targetMarket, targetPosition) {
        const view = this.state.view;
        if (!view || this.state.busy) return;
        this.setState({ busy: itemId, error: '' });
        try {
            const result = await this.send('moveShoppingItem', {
                listName: view.listName,
                itemId,
                targetMarket,
                targetPosition,
            });
            if (result?.view) this.setState({ view: result.view });
            if (!result?.ok) throw new Error(result?.error || 'The item could not be moved.');
            this.setState({ busy: '' });
        } catch (error) {
            this.setState({ busy: '', error: error instanceof Error ? error.message : String(error) });
            await this.load(view.listName);
        }
    }

    async clearManual() {
        const view = this.state.view;
        if (!view || this.state.busy) return;
        this.setState({ busy: '__clear__', error: '' });
        try {
            const result = await this.send('clearManualShoppingOrder', { listName: view.listName });
            if (result?.view) this.setState({ view: result.view });
            if (!result?.ok) throw new Error(result?.error || 'Manual order could not be cleared.');
            this.setState({ busy: '' });
        } catch (error) {
            this.setState({ busy: '', error: error instanceof Error ? error.message : String(error) });
            await this.load(view.listName);
        }
    }

    onDragStart(event, itemId) {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', itemId);
    }

    onDrop(event, market, position) {
        event.preventDefault();
        const itemId = event.dataTransfer.getData('text/plain');
        if (itemId) void this.move(itemId, market, position);
    }

    renderCard(item, marketItems, index, view) {
        const busy = Boolean(this.state.busy);
        return h(
            'div',
            {
                key: item.id,
                className: 'shoppingroute-card',
                draggable: !busy,
                onDragStart: event => this.onDragStart(event, item.id),
                onDragOver: event => event.preventDefault(),
                onDrop: event => this.onDrop(event, item.market, index),
                title: text('Ziehen oder die Schaltflächen benutzen', 'Drag or use the buttons'),
            },
            [
                h('div', { key: 'text', style: { fontWeight: 600, wordBreak: 'break-word' } }, item.text),
                h(
                    'div',
                    { key: 'meta', style: { fontSize: '0.82rem', opacity: 0.72, marginTop: '3px' } },
                    (item.category || text('Ohne Produktgruppe', 'No product group')) + (item.manual ? ' · ' + text('manuell', 'manual') : ''),
                ),
                h('div', { key: 'controls', className: 'shoppingroute-card-controls' }, [
                    h(
                        'button',
                        {
                            key: 'up',
                            type: 'button',
                            className: 'shoppingroute-list-button',
                            disabled: busy || index === 0,
                            title: text('Nach oben', 'Move up'),
                            onClick: () => void this.move(item.id, item.market, index - 1),
                        },
                        '↑',
                    ),
                    h(
                        'button',
                        {
                            key: 'down',
                            type: 'button',
                            className: 'shoppingroute-list-button',
                            disabled: busy || index === marketItems.length - 1,
                            title: text('Nach unten', 'Move down'),
                            onClick: () => void this.move(item.id, item.market, index + 1),
                        },
                        '↓',
                    ),
                    h(
                        'select',
                        {
                            key: 'market',
                            value: item.market,
                            disabled: busy,
                            'aria-label': text('In einen anderen Markt verschieben', 'Move to another market'),
                            onChange: event => {
                                const target = event.target.value;
                                const count = view.items.filter(entry => entry.market === target && entry.id !== item.id).length;
                                void this.move(item.id, target, count);
                            },
                        },
                        view.markets.map(market => h('option', { key: market, value: market }, market)),
                    ),
                ]),
            ],
        );
    }

    render() {
        const view = this.state.view;
        const busy = Boolean(this.state.busy);
        const children = [h('style', { key: 'styles' }, responsiveStyles)];
        children.push(
            h('div', { key: 'intro', style: { marginBottom: '12px', lineHeight: 1.45 } }, [
                h('strong', { key: 'title' }, text('Aktuelle Einkaufsliste', 'Current shopping list')),
                h(
                    'div',
                    { key: 'hint', style: { opacity: 0.75, marginTop: '3px' } },
                    text(
                        'Artikel können gezogen oder mit Pfeilen und Marktauswahl verschoben werden. Änderungen werden direkt in Alexa bestätigt.',
                        'Items can be dragged or moved with the arrows and market selector. Changes are confirmed directly in Alexa.',
                    ),
                ),
            ]),
        );
        if (this.state.error) {
            children.push(h('div', { key: 'error', style: { padding: '9px', border: '1px solid currentColor', borderRadius: '6px', marginBottom: '10px' } }, this.state.error));
        }
        if (this.state.loading || !view) {
            children.push(h('div', { key: 'loading' }, text('Liste wird geladen …', 'Loading list …')));
            return h('div', { style: { width: '100%' } }, children);
        }
        children.push(
            h('div', { key: 'toolbar', className: 'shoppingroute-list-toolbar' }, [
                h(
                    'select',
                    {
                        key: 'list',
                        value: view.listName,
                        disabled: busy,
                        onChange: event => void this.load(event.target.value),
                        'aria-label': text('Einkaufsliste auswählen', 'Select shopping list'),
                    },
                    view.lists.map(list => h('option', { key: list, value: list }, list)),
                ),
                h('button', { key: 'refresh', type: 'button', className: 'shoppingroute-list-button', disabled: busy, onClick: () => void this.load(view.listName) }, text('Aktualisieren', 'Refresh')),
                h('button', { key: 'clear', type: 'button', className: 'shoppingroute-list-button', disabled: busy, onClick: () => void this.clearManual() }, text('Manuelle Reihenfolge zurücksetzen', 'Reset manual order')),
                view.dryRun ? h('strong', { key: 'dry', style: { marginLeft: 'auto' } }, text('Dry Run aktiv – Verschieben gesperrt', 'Dry Run active – moving is disabled')) : null,
            ]),
        );
        const columns = view.markets.map(market => {
            const items = view.items.filter(item => item.market === market);
            return h(
                'section',
                {
                    key: market,
                    className: 'shoppingroute-market-column',
                    onDragOver: event => event.preventDefault(),
                    onDrop: event => this.onDrop(event, market, items.length),
                },
                [
                    h('h3', { key: 'title', style: { margin: '0 0 6px' } }, market + ' (' + items.length + ')'),
                    items.length
                        ? items.map((item, index) => this.renderCard(item, items, index, view))
                        : h('div', { key: 'empty', style: { opacity: 0.62, padding: '12px 0' } }, text('Hierher ziehen', 'Drop here')),
                ],
            );
        });
        children.push(h('div', { key: 'grid', className: 'shoppingroute-market-grid' }, columns));
        return h('div', { style: { width: '100%' } }, children);
    }
}

module.exports = { Components: { ShoppingListEditor }, ShoppingListEditor };
`);

write('vite.shopping-list.config.mjs', `import { resolve } from 'node:path';

import { federation } from '@module-federation/vite';
import commonjs from 'vite-plugin-commonjs';

export default {
    plugins: [
        federation({
            manifest: true,
            name: 'ShoppingRouteShoppingListSet',
            filename: 'shoppingListEditor.js',
            exposes: {
                './Components': './src-admin/shopping-list-editor-components.mjs',
            },
            remotes: {},
            shared: {
                react: {
                    singleton: true,
                    requiredVersion: '>=18',
                },
            },
        }),
        commonjs(),
    ],
    base: './',
    build: {
        target: 'chrome89',
        outDir: 'admin/custom/shoppingList',
        emptyOutDir: true,
        rollupOptions: {
            input: resolve('src-admin/shopping-list-editor-components.mjs'),
        },
    },
};
`);

let buildAdmin = read('scripts/build-admin.js');
buildAdmin = replaceOnce(
    buildAdmin,
    `    {
        config: 'vite.markets.config.mjs',
        directory: 'markets',
        name: 'ShoppingRouteMarketsSet',
        remoteEntry: 'marketsEditor.js',
    },
];`,
    `    {
        config: 'vite.markets.config.mjs',
        directory: 'markets',
        name: 'ShoppingRouteMarketsSet',
        remoteEntry: 'marketsEditor.js',
    },
    {
        config: 'vite.shopping-list.config.mjs',
        directory: 'shoppingList',
        name: 'ShoppingRouteShoppingListSet',
        remoteEntry: 'shoppingListEditor.js',
    },
];`,
    'shopping-list admin build',
);
write('scripts/build-admin.js', buildAdmin);

// -----------------------------------------------------------------------------
// jsonConfig: RD tabs style + shopping list tab + accepted review state
// -----------------------------------------------------------------------------
const adminConfig = json('admin/jsonConfig.json');
adminConfig.tabsStyle = { ...(adminConfig.tabsStyle || {}), width: 'calc(100% - 100px)' };
adminConfig.items.shoppingListTab = {
    type: 'panel',
    label: 'ui.items.shoppinglisttab.label',
    items: {
        shoppingListEditor: {
            type: 'custom',
            url: 'custom/shoppingList/shoppingListEditor.js',
            name: 'ShoppingRouteShoppingListSet/Components/ShoppingListEditor',
            guiApi: 2,
            i18n: false,
            xs: 12,
            sm: 12,
            md: 12,
            lg: 12,
            xl: 12,
        },
    },
};
const actionColumn = adminConfig.items.reviewTab.items.reviewItems.items.find(item => item.attr === 'action');
if (!actionColumn) throw new Error('Review action column not found');
if (!actionColumn.options.some(option => option.value === 'accepted')) {
    const acceptIndex = actionColumn.options.findIndex(option => option.value === 'accept');
    actionColumn.options.splice(acceptIndex + 1, 0, {
        value: 'accepted',
        label: 'ui.items.reviewtab.items.reviewitems.items.5.options.3.label',
    });
}
writeJson('admin/jsonConfig.json', adminConfig);

const labels = {
    de: ['Einkaufsliste', 'Übernommen'],
    en: ['Shopping list', 'Accepted'],
    ru: ['Список покупок', 'Принято'],
    pt: ['Lista de compras', 'Aceite'],
    nl: ['Boodschappenlijst', 'Overgenomen'],
    fr: ['Liste de courses', 'Accepté'],
    it: ['Lista della spesa', 'Accettato'],
    es: ['Lista de compra', 'Aceptado'],
    pl: ['Lista zakupów', 'Zaakceptowano'],
    uk: ['Список покупок', 'Прийнято'],
    'zh-cn': ['购物清单', '已接受'],
};
for (const [lang, [shoppingList, accepted]] of Object.entries(labels)) {
    const rel = `admin/i18n/${lang}.json`;
    const translations = json(rel);
    translations['ui.items.shoppinglisttab.label'] = shoppingList;
    translations['ui.items.reviewtab.items.reviewitems.items.5.options.3.label'] = accepted;
    writeJson(rel, translations);
}

// -----------------------------------------------------------------------------
// Tests for manual movement, review status, Admin 8 component and RD layout
// -----------------------------------------------------------------------------
write('test/manual-order.test.js', `'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { moveManualOverride, reconcileManualOverrides } = require('../build/lib/manual-order');
const { buildPrefixTargets } = require('../build/lib/prefix-sort');

test('manual override moves one item to another market and wins over automatic assignment', () => {
    const items = [
        { id: '1', value: '10> Milch', completed: false, version: 2 },
        { id: '2', value: '20> Brot', completed: false, version: 2 },
    ];
    const markets = [
        { name: 'ALDI', order: 10, enabled: true },
        { name: 'LIDL', order: 20, enabled: true },
    ];
    const products = [
        { name: 'Milch', category: 'Milch', defaultMarket: 'ALDI' },
        { name: 'Brot', category: 'Brot', defaultMarket: 'ALDI' },
    ];
    const moved = moveManualOverride([], {
        listName: 'SHOP', itemId: '2', originalText: 'Brot', fromMarket: 'ALDI', fromPosition: 1,
        toMarket: 'LIDL', toPosition: 0,
    });
    const targets = buildPrefixTargets(items, markets, [], products, 'Ohne Markt', '', 1, false, moved, 'SHOP');
    assert.equal(targets.find(target => target.id === '2').market, 'LIDL');
    assert.equal(targets.filter(target => target.market === 'LIDL')[0].id, '2');
});

test('manual override is rebound after an Amazon suffix rebuild changes the item id', () => {
    const overrides = [{
        listName: 'SHOP', itemId: 'old', originalText: 'Milch', market: 'LIDL', position: 0,
        updatedAt: new Date().toISOString(),
    }];
    const reconciled = reconcileManualOverrides(overrides, 'SHOP', [
        { id: 'new', value: '42> Milch', completed: false, version: 1 },
    ]);
    assert.equal(reconciled.length, 1);
    assert.equal(reconciled[0].itemId, 'new');
    assert.equal(reconciled[0].market, 'LIDL');
});
`);

write('test/review-accepted-status.test.js', `'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { applyReviewActions } = require('../build/lib/sorter');

test('accepted review rows remain as accepted status and are not applied twice', () => {
    const review = {
        key: 'milch', text: 'Milch', product: 'Milch', guessedCategory: 'Milchprodukte', market: 'ALDI',
        category: 'Milchprodukte', defaultMarket: 'ALDI', availableMarkets: 'ALDI,LIDL', aliases: '', action: 'accept',
    };
    const first = applyReviewActions([], [review]);
    assert.equal(first.accepted.length, 1);
    assert.equal(first.remainingReviews.length, 1);
    assert.equal(first.remainingReviews[0].action, 'accepted');
    const second = applyReviewActions(first.products, first.remainingReviews);
    assert.equal(second.accepted.length, 0);
    assert.equal(second.remainingReviews[0].action, 'accepted');
});
`);

write('test/shopping-list-admin.test.js', `'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const config = JSON.parse(fs.readFileSync(path.join(root, 'admin/jsonConfig.json'), 'utf8'));
const source = fs.readFileSync(path.join(root, 'src-admin/shopping-list-editor.js'), 'utf8');
const routeSource = fs.readFileSync(path.join(root, 'src-admin/route-editor.js'), 'utf8');
const main = fs.readFileSync(path.join(root, 'src/main.ts'), 'utf8');

test('shopping list Admin tab uses an Admin 8 custom component and safe responsive widths', () => {
    const editor = config.items.shoppingListTab.items.shoppingListEditor;
    assert.equal(editor.guiApi, 2);
    assert.equal(editor.name, 'ShoppingRouteShoppingListSet/Components/ShoppingListEditor');
    assert.equal(editor.url, 'custom/shoppingList/shoppingListEditor.js');
    assert.equal(config.tabsStyle.width, 'calc(100% - 100px)');
    assert.match(source, /@media \(max-width: 600px\)/);
    assert.match(source, /draggable:/);
    assert.match(source, /moveShoppingItem/);
    assert.match(source, /clearManualShoppingOrder/);
});

test('route editor has a 600px mobile layout and no fixed 240px minimum control width', () => {
    assert.match(routeSource, /@media \(max-width: 600px\)/);
    assert.doesNotMatch(routeSource, /minWidth: '240px'/);
});

test('runtime exposes shopping list read, move and reset commands without browser credentials', () => {
    assert.match(main, /obj\.command === 'getShoppingList'/);
    assert.match(main, /obj\.command === 'moveShoppingItem'/);
    assert.match(main, /obj\.command === 'clearManualShoppingOrder'/);
    assert.match(main, /info\.manualOverrides/);
});
`);

// Extend the existing review test with the retained status option.
let reviewTest = read('test/review-accept-all.test.js');
reviewTest = replaceOnce(
    reviewTest,
    `    assert.equal(button.useNative, true);
`,
    `    assert.equal(button.useNative, true);
    const actionColumn = config.items.reviewTab.items.reviewItems.items.find(item => item.attr === 'action');
    assert.ok(actionColumn.options.some(option => option.value === 'accepted'));
`,
    'review accepted Admin option test',
);
write('test/review-accept-all.test.js', reviewTest);

// -----------------------------------------------------------------------------
// Documentation
// -----------------------------------------------------------------------------
let readme = read('README.md');
readme = readme.replace('**Current version: 0.3.6**', '**Current version: 0.3.7**');
readme = replaceOnce(
    readme,
    '## Changelog\n\n### 0.3.6',
    `## Changelog

### 0.3.7 (2026-09-11)

- Added an interactive current shopping-list view to Admin with drag-and-drop plus touch-friendly arrow/market controls.
- Manual item positions and market moves are persisted locally and take precedence over automatic sorting while that active list item exists.
- Alexa writes are performed by the adapter; the browser receives no Alexa/Amazon credentials, and failed moves reload the confirmed list state.
- Improved responsive Admin layouts for xs/sm screens and added the repository Responsive Design tab width recommendation.
- Review entries now retain an idempotent “Accepted” status after a normal Save instead of falling back to “Pending”.

### 0.3.6`,
    'README 0.3.7 changelog',
);
write('README.md', readme);

let readmeDe = read('README_DE.md');
readmeDe = readmeDe.replace('**Aktuelle Version: 0.3.6**', '**Aktuelle Version: 0.3.7**');
readmeDe = replaceOnce(
    readmeDe,
    '## Changelog\n\n### 0.3.6',
    `## Changelog

### 0.3.7 (2026-09-11)

- Interaktive aktuelle Einkaufsliste im Admin ergänzt: Drag&Drop sowie touch-taugliche Pfeil- und Marktauswahl stehen parallel zur Verfügung.
- Manuelle Artikelpositionen und Marktverschiebungen werden lokal gespeichert und haben Vorrang vor der automatischen Sortierung, solange der aktive Listeneintrag existiert.
- Alexa-Schreibzugriffe erfolgen ausschließlich im Adapter; der Browser erhält keine Alexa-/Amazon-Zugangsdaten. Bei Fehlern wird die bestätigte Liste neu geladen.
- Responsive Admin-Darstellung für xs/sm verbessert und die empfohlene Tab-Breite der Responsive Design Initiative ergänzt.
- Prüflisteneinträge behalten nach normalem Speichern nun den idempotenten Status „Übernommen“, statt wieder auf „Offen“ zurückzufallen.

### 0.3.6`,
    'README_DE 0.3.7 changelog',
);
write('README_DE.md', readmeDe);

console.log('0.3.7 development changes applied successfully.');
