# Contributing

Contributions are welcome.

The most important architectural rule is the Alexa-list safety invariant:

**shoppingroute must not create, delete or complete Alexa list entries.**

Do not add writes to `#New`, `#delete` or `completed` without a major design review and an explicit safety discussion.

Before opening a pull request:

```bash
npm install
npm run build
npm test
```

Please include tests for changes to parsing or sorting behavior.
