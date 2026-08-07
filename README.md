# ioBroker.shoppingroute

**Development status: 0.0.1 – early test version**

`ioBroker.shoppingroute` sorts existing Alexa shopping-list entries by **store** and by the **configured walking route inside each store**, while keeping the original Alexa app as the only shopping app.

## Core concept

The Alexa app must be configured to sort the shopping list by **Oldest to newest**.

The adapter reads active Alexa list items, sorts the existing item IDs by `createdDateTime`, independently sorts the visible product texts by **market → category route → product**, and redistributes only the `value` texts across the existing IDs.

### Safety invariant

This adapter never uses:

- `#New`
- `#delete`
- `completed`

It therefore does not create, delete or complete Alexa list entries.

## Features in 0.0.1

- configurable Alexa2 instance and list name
- Dry-Run enabled by default
- unlimited market/main-category configuration
- market aliases, e.g. `Aldi,Aldi Nord`
- separate category walking route for every market
- product catalogue with aliases, category and optional default market
- explicit phrases such as `Bananen von Aldi` / `Bananen bei Aldi`
- quantity-aware recognition while keeping the visible Alexa text unchanged
- heuristic category guess for unknown products
- safe abort/recalculate when active IDs change while sorting
- diagnostic states and complete sorting plan as JSON

German documentation: [README_DE.md](README_DE.md)

## Important Alexa2 compatibility note

During development in August 2026, the tested `alexa-remote2` version contained a malformed version query in `updateListItem` (`?version =...`). Public release of this adapter should require an upstream-fixed Alexa2/alexa-remote2 version. End users must not be required to patch `node_modules` manually.

## Development

```bash
npm install
npm run build
npm test
```

Repository target: `https://github.com/RaviniZib/ioBroker.shoppingroute`

## License

MIT © 2026 RaviniZib
