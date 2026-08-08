# ShoppingRoute test report

Version: **0.2.0-beta.4**

Local source/unit verification in the build environment:

- 31 tests executed
- 31 passed
- 0 failed
- JSON files parse successfully
- route synchronization adds missing rows for new markets/product groups
- route administration groups markets alphabetically while preserving each market's walking-route order
- walking-route table includes a native market filter
- Alexa safety test still finds no `#New`, `#delete` or automatic `completed` write path
- ioBroker checker metadata tests cover type/tier/extIcon/translations/testing dependency/i18n
- adapter-managed timers are used instead of plain global timers

The full `npm test` must additionally be executed on the ioBroker development host after `npm install`, because the OpenAI build environment does not provide `@iobroker/adapter-core` from its internal npm mirror.
