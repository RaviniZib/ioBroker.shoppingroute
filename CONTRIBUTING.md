# Contributing

Contributions are welcome.

The most important architectural rule is the Alexa-list safety invariant:

**shoppingroute must not create, delete or complete Alexa list entries.**

Do not add writes to Alexa2 list-item states or `completed`. Direct Amazon PUT/DELETE/batch-CREATE changes require a design review, explicit safety handling and final direct verification.

Before opening a pull request:

```bash
npm install
npm run build
npm test
```

Please include tests for changes to parsing or sorting behavior.
