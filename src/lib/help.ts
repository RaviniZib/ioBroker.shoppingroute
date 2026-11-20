/**
 * The answer of the message `help`: what the instance answers, written for AI agents (e.g. ioBroker.pi-agent or
 * the MCP server with `send_to`) and script authors. Keep it in sync with `onMessage` in main.ts.
 */

/** Every command `onMessage` answers; write = it changes something */
export const COMMANDS: { command: string; write: boolean }[] = [
    { command: 'help', write: false },
    { command: 'getShoppingList', write: false },
    { command: 'getLists', write: false },
    { command: 'getMarkets', write: false },
    { command: 'getProductGroups', write: false },
    { command: 'addShoppingItem', write: true },
    { command: 'deleteShoppingItem', write: true },
    { command: 'applyShoppingChanges', write: true },
    { command: 'moveShoppingItem', write: true },
    { command: 'getShoppingMoveStatus', write: false },
    { command: 'clearManualShoppingOrder', write: true },
    { command: 'createAlexaList', write: true },
    { command: 'getManagedConfig', write: false },
    { command: 'saveManagedConfig', write: true },
    { command: 'getAlexaLists', write: false },
    { command: 'getActiveMarkets', write: false },
    { command: 'getMarketsOptional', write: false },
    { command: 'getBringLists', write: false },
    { command: 'getBackupUiUrl', write: false },
    { command: 'normalizeMarketSelection', write: false },
    { command: 'markAllReviewItemsAccept', write: false },
];

export const HELP = `ioBroker.shoppingroute: sorts Amazon Alexa shopping lists (read through the alexa2 adapter) by market, product
group and the walking route through each market, with visible prefixes such as "20> Bananas" and optional market
headings. Optionally it syncs a Bring! list (bring adapter). An agent can read a managed list grouped by market, add
and delete items, move an item to another market or place, create Alexa lists and read markets and product groups.

Commands (sendTo shoppingroute.0, every command needs a callback):
- getShoppingList {listName?}: the list as sorted: {listName, lists, markets, items: [{id, text, market, category,
  position, manual}], dryRun}. position counts from 0 within the market; manual = placed by hand. listName: one of
  the configured lists (exact name); unknown or missing = the first one. Error: {error}.
- getLists: the Alexa lists of the alexa2 instance and the configured ones: [{value, label}] (value = list name).
- getMarkets: the enabled markets (names in upper case): [{value, label}].
- getProductGroups: the product groups: [{value, label}].
- addShoppingItem {listName, text}: adds an item (1 to 500 characters, no "NN>" prefix, at most 99 active items)
  to the Alexa list listName (exact name as in lists of getShoppingList); it is sorted in afterwards:
  {ok: true, view} (view as getShoppingList) or {ok: false, error}.
- deleteShoppingItem {listName, itemId}: deletes an item from the Alexa list (itemId = id from getShoppingList):
  {ok, error?, view?}.
- applyShoppingChanges {requestId, listName?, moves: [{itemId, itemText?, targetMarket, targetPosition}]}: moves
  items to another market (one of markets) and/or position (0 = first in that market) in one verified transaction
  and keeps them there. moveShoppingItem {requestId, listName?, itemId, itemText?, targetMarket, targetPosition}:
  the same for one item. requestId = any unique text. Both answer at once {ok: true, pending: true, requestId} (or
  {ok: false, error}); then ask getShoppingMoveStatus {requestId} every few seconds while it answers pending: the
  result {ok, error?, view} is given once. Applying can take minutes.
- clearManualShoppingOrder {listName?}: drops the hand-made places of the list and sorts it again: {ok, error?, view}.
- createAlexaList {name}: creates an Alexa list (1 to 100 characters; an existing one of that name is used) and adds
  it to the managed lists: {ok, name, listId, lists, savedAt} or {ok: false, error}.
- getManagedConfig: markets, routes, products, product groups, lists and review items: {ok, savedAt, data}.
  saveManagedConfig {data}: replaces all of them like the management page: {ok, savedAt, data} or {ok: false, error}.
- getAlexaLists, getActiveMarkets, getMarketsOptional, getBringLists, getBackupUiUrl, normalizeMarketSelection,
  markAllReviewItemsAccept: for the settings, not for agents.
add, delete, the moves, clearManualShoppingOrder and createAlexaList answer {ok: false, error} while Dry Run is on
(the default after installation), while another change runs ("try again"), with the Bring! mode "bring-only"
(read-only) and, except createAlexaList, while control.enabled is false.

States (shoppingroute.0.*): control.enabled (false = no sorting, no changes), control.sortNow (true = sort all lists
now), control.temporaryPriorityMarket (a market name: items without a fixed market that are sold there go to it, for
one shopping trip; "__none__" = none), info.lastError.

How to talk to the user:
- If more than one list is configured and the user names none, ask which list; name items by text and market, never
  by id; give the list grouped by market in route order.
- Add, delete and move items only on the user's request; deleting and moving several items: say which ones first.
- createAlexaList, saveManagedConfig and clearManualShoppingOrder only on the user's explicit request.
- If the answer says Dry Run is active, tell the user; do not switch it off yourself.`;
