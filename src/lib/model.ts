export interface AlexaListItem {
    id: string;
    value: string;
    completed: boolean;
    listId?: string;
    version?: number;
    createdDateTime?: number | string;
    updatedDateTime?: number | string;
}

export interface MarketConfig {
    name: string;
    aliases?: string;
    order?: number;
    enabled?: boolean;
}

export interface ProductGroupConfig {
    name: string;
}

export interface RouteConfig {
    market: string;
    category: string;
    order?: number;
}

export interface ShoppingListConfig {
    name: string;
    enabled?: boolean;
    priorityMarket?: string;
}

export type ReviewAction = 'pending' | 'accept' | 'ignore';

export interface ReviewItemConfig {
    key: string;
    text: string;
    product: string;
    guessedCategory: string;
    market: string;
    category?: string;
    defaultMarket?: string;
    availableMarkets?: string | string[];
    aliases?: string;
    action?: ReviewAction;
    firstSeen?: string;
    lastSeen?: string;
}

export interface ProductConfig {
    name: string;
    aliases?: string;
    category: string;
    defaultMarket?: string;
    availableMarkets?: string | string[];
}

export type LearningMode = 'automatic' | 'review' | 'off';

export interface AdapterConfigShape {
    alexaInstance?: string;
    listName?: string;
    lists?: ShoppingListConfig[];
    dryRun?: boolean;
    autoLearnProducts?: boolean;
    learningMode?: LearningMode;
    autoAliasSuggestions?: boolean;
    debounceMs?: number;
    writePauseMs?: number;
    apiSafeMode?: boolean;
    maxWritesPerMinute?: number;
    batchSize?: number;
    batchPauseMs?: number;
    maxWriteRetries?: number;
    retryBaseMs?: number;
    marketHeaders?: boolean;
    minItemsPerMarket?: number;
    fallbackMarket?: string;
    priorityMarket?: string;
    temporaryPriorityMarket?: string;
    productGroups?: ProductGroupConfig[];
    markets?: MarketConfig[];
    routes?: RouteConfig[];
    products?: ProductConfig[];
    reviewItems?: ReviewItemConfig[];
}

export interface ParsedItem {
    originalText: string;
    productText: string;
    productName: string;
    market: string;
    category: string;
    knownProduct: boolean;
    explicitMarket: boolean;
    quantityPrefix: string;
    ambiguousMarketSuffix?: string;
}

export interface MarketProfile {
    format: 'shoppingroute-market-profile-v1';
    market: MarketConfig;
    route: RouteConfig[];
}

export interface ConfigExport {
    format: 'shoppingroute-config-v1';
    exportedAt: string;
    version: string;
    config: Partial<AdapterConfigShape>;
}
