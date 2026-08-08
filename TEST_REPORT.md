# ShoppingRoute test report

Version: **0.2.0-beta.7**

Local source/unit verification in the build environment:

- 37 tests defined for the beta.7 suite
- 16 Admin/config tests passed in the local artifact check; the full 37-test suite must be confirmed on the ioBroker host
- 0 failed
- JSON files parse successfully
- Alexa2 selection is restricted to installed/enabled Alexa2 instances
- Alexa-list dropdowns are populated from detected `Lists.*.json` objects
- walking routes use a standalone native market dropdown plus a calculated one-market table; no custom Module Federation component is required
- API protection is integrated into General settings
- route synchronization still adds missing rows for new markets/product groups
- Alexa safety test still finds no `#New`, `#delete` or automatic `completed` write path
- ioBroker checker metadata tests cover type/tier/extIcon/testing dependency and centralized reusable Admin i18n variables
- adapter-managed timers are used instead of plain global timers

The full `npm test` must additionally be executed on the ioBroker development host after `npm install`. No custom Admin bundle is built; the Admin UI uses native JSON Config controls only.
