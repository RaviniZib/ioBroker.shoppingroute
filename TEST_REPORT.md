# Test report – 0.2.0-beta.1

Local checks before server validation:

- Source/unit tests that do not need the unavailable local ioBroker npm dependency: **26/26 passed**
- Runtime and package-builder JavaScript syntax checks: passed
- Safety rule: no Alexa `#New`, `#delete` or `.completed` write path detected
- Daily API/traffic metric tests: passed
- Closed-beta license/package metadata tests: passed
- Full `npm test`, dependency installation and the final obfuscated tester-package build must still be validated on the ioBroker development server because this local build environment cannot fetch `@iobroker/adapter-core` from its internal npm mirror.
