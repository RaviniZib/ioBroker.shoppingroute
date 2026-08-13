export interface ExpectedItemTransition {
    type: 'item';
    id: string;
    from: string;
    to: string;
}

export interface ExpectedHeaderCreateTransition {
    type: 'header-create';
    value: string;
}

export interface ExpectedHeaderDeleteTransition {
    type: 'header-delete';
    id: string;
}

export type ExpectedListTransition =
    | ExpectedItemTransition
    | ExpectedHeaderCreateTransition
    | ExpectedHeaderDeleteTransition;

export interface ListValueItem {
    id?: unknown;
    value?: unknown;
    completed?: unknown;
}

export type ExpectedListEventClassification = 'expected' | 'external';
export type HeaderActionObservation = 'confirmed' | 'pending' | 'ambiguous';

function scalarText(value: unknown): string {
    return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
        ? String(value)
        : '';
}

export function activeListValues(items: ListValueItem[]): Map<string, string> {
    return new Map(items
        .filter(item => item?.completed === false && scalarText(item?.id))
        .map(item => [scalarText(item.id), scalarText(item.value).trim()]));
}

function sameExpectedValues(
    current: Map<string, string>,
    expected: ReadonlyMap<string, string>,
    transition?: ExpectedListTransition,
): boolean {
    if (!transition || transition.type === 'item') {
        if (current.size !== expected.size) return false;
        for (const [id, expectedValue] of expected) {
            const currentValue = current.get(id);
            if (currentValue === expectedValue) continue;
            if (
                transition?.type === 'item' &&
                id === transition.id &&
                (currentValue === transition.from || currentValue === transition.to)
            ) continue;
            return false;
        }
        return true;
    }

    if (transition.type === 'header-create') {
        if (current.size !== expected.size && current.size !== expected.size + 1) return false;
        for (const [id, value] of expected) {
            if (current.get(id) !== value) return false;
        }
        const added = [...current].filter(([id]) => !expected.has(id));
        return added.length === 0 || (added.length === 1 && added[0][1] === transition.value);
    }

    if (current.size !== expected.size && current.size !== expected.size - 1) return false;
    for (const [id, value] of expected) {
        if (id === transition.id && !current.has(id)) continue;
        if (current.get(id) !== value) return false;
    }
    return true;
}

/**
 * Classifies a list JSON refresh against the values expected by the active ShoppingRoute transaction.
 *
 * @param items Current Alexa2 list JSON items.
 * @param expected Stable active values currently expected by ShoppingRoute.
 * @param transition Optional in-flight ShoppingRoute write.
 * @returns Whether the refresh is fully explained by the active transaction.
 */
export function classifyExpectedListEvent(
    items: ListValueItem[],
    expected: ReadonlyMap<string, string>,
    transition?: ExpectedListTransition,
): ExpectedListEventClassification {
    return sameExpectedValues(activeListValues(items), expected, transition) ? 'expected' : 'external';
}

/**
 * Observes one managed header create/delete without accepting unrelated list changes.
 *
 * @param items Current Alexa2 list JSON items.
 * @param expected Stable active values before the header write.
 * @param transition Header write being observed.
 * @returns Whether the header write settled, is pending, or conflicts with another change.
 */
export function classifyHeaderActionObservation(
    items: ListValueItem[],
    expected: ReadonlyMap<string, string>,
    transition: ExpectedHeaderCreateTransition | ExpectedHeaderDeleteTransition,
): HeaderActionObservation {
    const current = activeListValues(items);
    if (!sameExpectedValues(current, expected, transition)) return 'ambiguous';
    if (transition.type === 'header-create') {
        return [...current].some(([id, value]) => !expected.has(id) && value === transition.value)
            ? 'confirmed'
            : 'pending';
    }
    const allIds = new Set(items.map(item => scalarText(item.id)).filter(Boolean));
    return allIds.has(transition.id) ? 'pending' : 'confirmed';
}
