import type { AlexaListItem, MarketConfig } from './model';
import { isMarketHeader } from './market-plan';
import { parseSortPrefix, stripSortPrefix } from './prefix-sort';

export interface MobileMarketMove {
    command: AlexaListItem;
    target: AlexaListItem;
    market: string;
    number: number;
}

export type MobileMoveResolution =
    | { status: 'none'; moves: [] }
    | { status: 'invalid'; moves: []; reason: string }
    | { status: 'ready'; moves: MobileMarketMove[] };

const COMMAND_PATTERN = /^(\d{2})W(.+)$/i;

function normalized(value: string): string {
    return value.trim().normalize('NFKC').toLocaleUpperCase('de-DE');
}

function editDistance(left: string, right: string): number {
    const previous = Array.from({ length: right.length + 1 }, (_, i) => i);
    for (let i = 1; i <= left.length; i++) {
        let diagonal = previous[0];
        previous[0] = i;
        for (let j = 1; j <= right.length; j++) {
            const old = previous[j];
            previous[j] = Math.min(previous[j] + 1, previous[j - 1] + 1, diagonal + (left[i - 1] === right[j - 1] ? 0 : 1));
            diagonal = old;
        }
    }
    return previous[right.length];
}

/** Match configured, enabled markets only; never guess between equally plausible names. */
export function resolveMobileMarket(input: string, markets: MarketConfig[]): string | undefined {
    const requested = normalized(input);
    if (!requested) return undefined;
    const enabled = markets.filter(market => market.enabled !== false && normalized(market.name));
    const exact = enabled.filter(market => normalized(market.name) === requested);
    if (exact.length === 1) return exact[0].name;
    if (exact.length > 1) return undefined;
    const tolerance = requested.length > 6 ? 2 : 1;
    const candidates = enabled
        .map(market => ({ market, distance: editDistance(requested, normalized(market.name)) }))
        .filter(entry => entry.distance <= tolerance)
        .sort((a, b) => a.distance - b.distance);
    if (!candidates.length) return undefined;
    if (candidates.length > 1 && candidates[0].distance === candidates[1].distance) return undefined;
    return candidates[0].market.name;
}

/** Resolve all commands against one unchanged Amazon snapshot, before any writes. */
export function resolveMobileMoves(snapshot: AlexaListItem[], markets: MarketConfig[]): MobileMoveResolution {
    const active = snapshot.filter(item => item && item.completed === false && item.id);
    const commands = active
        .map(item => ({ item, match: stripSortPrefix(item.value).match(COMMAND_PATTERN) }))
        .filter((entry): entry is { item: AlexaListItem; match: RegExpMatchArray } => entry.match !== null);
    if (!commands.length) return { status: 'none', moves: [] };
    const commandIds = new Set(commands.map(entry => String(entry.item.id)));
    const usedTargets = new Set<string>();
    const moves: MobileMarketMove[] = [];
    for (const { item: command, match } of commands) {
        const number = Number(match[1]);
        const market = resolveMobileMarket(match[2], markets);
        const candidates = active.filter(item =>
            !commandIds.has(String(item.id)) &&
            !isMarketHeader(stripSortPrefix(item.value), markets) &&
            parseSortPrefix(item.value)?.number === number,
        );
        if (!market || candidates.length !== 1 || usedTargets.has(String(candidates[0].id)) ||
            !Number.isInteger(Number(command.version)) || Number(command.version) <= 0) {
            return { status: 'invalid', moves: [], reason: `Cannot uniquely resolve mobile move ${stripSortPrefix(command.value)}.` };
        }
        usedTargets.add(String(candidates[0].id));
        moves.push({ command, target: candidates[0], market, number });
    }
    return { status: 'ready', moves };
}
