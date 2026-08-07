export interface AlexaListItem {
    id: string;
    value: string;
    completed: boolean;
    createdDateTime?: number | string;
    updatedDateTime?: number | string;
}

export interface MarketConfig {
    name: string;
    aliases?: string;
    order?: number;
    enabled?: boolean;
}

export interface RouteConfig {
    market: string;
    category: string;
    order: number;
}

export interface ProductConfig {
    name: string;
    aliases?: string;
    category: string;
    defaultMarket?: string;
}

export interface AdapterConfigShape {
    alexaInstance?: string;
    listName?: string;
    dryRun?: boolean;
    autoLearnProducts?: boolean;
    debounceMs?: number;
    writePauseMs?: number;
    fallbackMarket?: string;
    priorityMarket?: string;
    markets?: MarketConfig[];
    routes?: RouteConfig[];
    products?: ProductConfig[];
}

export interface ParsedItem {
    originalText: string;
    productText: string;
    productName: string;
    market: string;
    category: string;
    knownProduct: boolean;
    explicitMarket: boolean;
}

export interface SortableItem {
    source: AlexaListItem;
    parsed: ParsedItem;
    marketOrder: number;
    categoryOrder: number;
}

export interface SortPlanEntry {
    position: number;
    id: string;
    createdDateTime: number;
    from: string;
    to: string;
    market: string;
    category: string;
    changed: boolean;
}
