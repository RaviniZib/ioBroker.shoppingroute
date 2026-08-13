# ShoppingRoute – User Guide

**Applies to: ioBroker.shoppingroute 0.2.0 (Stable)**

ShoppingRoute sorts active Alexa shopping-list entries by market, product group and your individual walking route. Visible two-digit prefixes from `00>` through `99>` are the sort keys. Market headings appear as `**** MARKET ****`. Individual entries are updated directly; when a numeric gap is exhausted, only the necessary list suffix is deleted and recreated in one batch. ShoppingRoute never marks items as completed automatically.

> **Important:** Every Alexa list managed by ShoppingRoute must be set to **A–Z** in the Alexa app. Keep **Dry Run** enabled during the initial setup.

## 1. Requirements

- ioBroker with Admin 7.6.20 or newer
- an installed and enabled Alexa2 instance
- at least one Alexa shopping list
- ShoppingRoute 0.2.0 or newer

## 2. Basic principle

For every item, ShoppingRoute answers three questions:

1. Which market does it belong to?
2. Which product group does it belong to?
3. At which position is that product group located in the walking route of the selected market?

Example walking route:

```text
ALDI
1. Fruit/vegetables
2. Bread/bakery
3. Meat/fish
4. Dairy products
5. Beverages
6. Frozen products
```

## 3. Initial setup

### Alexa2 instance

On the **General** tab, select the Alexa2 instance you want to use. Only installed and enabled instances are offered. After changing the Alexa2 instance, save the configuration once and reopen the configuration page so the available lists can be reloaded.

### Dry Run

With **Dry Run (do not write to Alexa)** enabled, ShoppingRoute reads and analyses the list and creates a sorting plan, but does not write any changes back to Alexa.

Only disable Dry Run after the preview looks correct.

## 4. Alexa lists

On the **Lists** tab, define which Alexa lists ShoppingRoute should manage.

Each list has:

- **Active** – whether the list is processed or ignored
- **Alexa list** – selection from the chosen Alexa2 instance
- **Default market for this list** – optional preferred market for this list only

Multiple Alexa lists can be managed at the same time. Each list may have its own default market.

## 5. Markets

On the **Markets** tab, maintain the stores where you shop.

Each market has:

- **Active**
- **Order**
- **Market**
- **Aliases**

Aliases are separated by commas, for example:

```text
REWE
Aliases: Rewe, Rewe Market, Rewe Center
```

The market order is the highest sorting level. Common variants of ALDI, LIDL, REWE and PENNY are additionally recognised automatically.

The **“No market”** fallback market is suitable for items that cannot be assigned unambiguously.

## 6. Product groups

On the **Product groups** tab, define the sections used to sort items within a market, for example:

- Fruit/vegetables
- Bread/bakery
- Meat/fish
- Dairy products
- Beverages
- Frozen products
- Household/hygiene
- Non-food
- Other

`Product groups` is the central master list of all known groups. Each market route is stored independently. The route editor offers only groups that are still missing from the selected market. Adding or deleting a route row changes neither the master list nor any other market route.

## 7. Walking routes

On the **Routes** tab, first select an active market. Only the walking route for that market is shown below.

The visible row order represents your path through the store. Different markets may have completely different walking routes.

Example:

```text
REWE
1. Beverages
2. Fruit/vegetables
3. Bread/bakery
4. Dairy products
5. Meat/fish
6. Frozen products
```

The internal order values are renumbered automatically.

## 8. Product catalogue

Known products are maintained on the **Products** tab.

### Name

The main product name, for example `Milk`.

### Aliases

Alternative names or spellings. Multiple aliases can be separated by commas or semicolons.

### Product group

Determines the position of the item within the walking route.

### Default market

Optional preferred market for this product. A product-specific default market has priority over general market priorities.

### Available markets

Multiple possible markets can be entered, separated by commas or semicolons, for example:

```text
ALDI, REWE, LIDL
```

**Important for version 0.2.0:** Multiple available markets are already supported. However, 0.2.0 does not yet perform global optimisation based on a minimum number of items per market.

## 9. Specify a market directly via Alexa

ShoppingRoute recognises explicitly named markets at the end of an entry, especially forms such as:

```text
Milk from REWE
Milk at ALDI
Cola at LIDL
```

An explicit market assignment has priority over the normal default and priority rules.

The parser currently recognises the configured market suffixes according to the adapter's supported expressions and market aliases. When using a non-German Alexa language, verify the wording in Dry Run first.

## 10. Quantities

Many common quantity expressions are separated from the actual product name for product recognition while remaining visible in the Alexa list text.

Examples:

```text
2 milk
3 packs of milk
two bottles of cola
1.5 kg potatoes
6x water
half a kilo of minced meat
```

## 11. Market priorities

If no market is explicitly specified, the following priority order generally applies:

1. market explicitly named in the Alexa text
2. product-specific default market
3. temporary market for the current shopping trip
4. default market of the respective Alexa list
5. global default market for shopping
6. first suitable market from “Available markets”
7. fallback market

The temporary market can be set through:

```text
shoppingroute.0.control.temporaryPriorityMarket
```

This makes it possible to prefer a different market for a single shopping trip without changing the permanent configuration.

## 12. Unknown products

Under **General → Unknown-product handling**, three modes are available:

- **Review first** – unknown items are added to the review queue
- **Learn automatically** – unambiguous unknown items are learned automatically
- **Do not learn** – unknown items are not permanently added

For normal operation, **Review first** is a good starting point.

## 13. Review queue

On the **Review** tab, unknown products can be checked before they are added.

You can edit, among other things:

- product name
- product group
- default market
- aliases
- action

Available actions are:

- **Pending**
- **Accept**
- **Ignore**

When an item is accepted, it is added to the product catalogue or an already known product is updated.

## 14. Alias suggestions

With **Suggest aliases automatically** enabled, ShoppingRoute tries to recognise different spellings of known products.

Suggestions are available under:

```text
shoppingroute.0.info.aliasSuggestions
```

## 15. Sorting preview

The following states are especially useful during setup:

```text
shoppingroute.0.info.preview
shoppingroute.0.info.previewText
shoppingroute.0.info.lastPlan
```

`previewText` contains a human-readable preview with position, previous text, target text, market and product group.

## 16. Manual sorting and automatic mode

A sorting run can be triggered manually through:

```text
shoppingroute.0.control.sortNow
```

Automatic sorting can be enabled or disabled through:

```text
shoppingroute.0.control.enabled
```

## 17. API protection

ShoppingRoute includes an API safe mode to avoid unnecessary direct Alexa write traffic. Batch CREATE is preferred, while individual PUT and DELETE requests run serially.

Settings include:

- maximum writes per minute
- writes per batch
- pause between batches
- maximum retries
- retry base delay
- pause between individual writes
- delay before processing a list change

For normal operation, keep API safe mode enabled unless there is a specific reason to change these values.

Current counters are available under:

```text
shoppingroute.0.info.traffic
```

## 18. Direct Alexa connection check

ShoppingRoute can check whether the local Alexa2 login can initialize a readable direct alexa-remote2 session. The check performs no test write.

Important states:

```text
shoppingroute.0.control.compatibilityTest
shoppingroute.0.info.compatibility
shoppingroute.0.info.lastCompatibilityTest
shoppingroute.0.info.writeCapability
```

## 19. Backup and restore

On the **Backup / sharing** tab, the **“Open backup / sharing”** button opens a separate interface.

There you can download the complete ShoppingRoute configuration as a JSON file and restore it later.

It is a good idea to create a backup before making major changes to markets, walking routes or the product catalogue.

## 20. Sharing market profiles

A market profile contains the market and its walking route. This makes it possible to transfer a maintained market configuration to another ShoppingRoute installation.

Under **Backup / sharing** you can:

1. select a market,
2. download its market profile,
3. import an existing market profile.

When imported, the matching market and its walking route are added or replaced by the imported profile.

## 21. Diagnostics and statistics

Useful information states include:

```text
shoppingroute.0.info.connection
shoppingroute.0.info.lastError
shoppingroute.0.info.lastSort
shoppingroute.0.info.statistics
shoppingroute.0.info.traffic
shoppingroute.0.info.feedbackReport
shoppingroute.0.info.versionInstalled
shoppingroute.0.info.versionBeta
shoppingroute.0.info.updateAvailable
```

The diagnostic/feedback report is intended to provide technical information without unnecessarily exposing shopping-list contents.

## 22. Typical problems

### Alexa lists are not offered

Check the Alexa2 instance, select it in ShoppingRoute, save the settings and reopen the configuration page.

### The order in Alexa looks wrong

Check that the affected list in the Alexa app is set to **A–Z** and that every active item has a `00>`–`99>` prefix.

### An item is assigned to the wrong market

Check in this order:

1. explicit market in the list text
2. product-specific default market
3. temporary market
4. list-specific default market
5. global default market
6. available markets
7. fallback market

### An item appears at the wrong position

Check the product group and the walking route of the relevant market.

### Unknown items are not added

Check the selected mode under **Unknown-product handling**.

### Too many write errors

Check API safe mode, write delays, `info.traffic`, `info.compatibility` and `info.lastError`.

## 23. Recommended initial setup

1. Select the Alexa2 instance.
2. Keep Dry Run enabled.
3. Select an Alexa list and set it to A–Z in the Alexa app.
4. Add or check your markets.
5. Check the product groups.
6. Sort the walking route for each market.
7. Maintain a few important products in the product catalogue.
8. Set the learning mode to **Review first**.
9. Add test items through Alexa.
10. Check `info.previewText`.
11. Process the review queue.
12. If the preview is correct, disable Dry Run.
13. Create a configuration backup.

## 24. Version note

This guide describes **ShoppingRoute 0.2.0**.

Planned features for later versions – especially automatically generated market headings in the Alexa list and cross-market optimisation based on a minimum number of items per market – are **not part of 0.2.0**.

## License

MIT License. Copyright (c) 2026 RaviniZib.
