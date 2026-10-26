"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendBringCommand = sendBringCommand;
/**
 * Writes exclusively to documented Bring! commands; never to Alexa2 states.
 *
 * @param adapter An ioBroker adapter with foreign state write access.
 * @param bringNamespace A validated Bring! list state namespace.
 * @param command A supported Bring! adapter command.
 * @param value Item name, optionally followed by comma-separated specifications.
 */
async function sendBringCommand(adapter, bringNamespace, command, value) {
    if (!/^bring\.\d+\.[\da-f-]{36}$/i.test(bringNamespace)) {
        throw new Error('Invalid Bring! list namespace.');
    }
    if (!String(value || '').trim())
        throw new Error('Empty Bring! command.');
    await adapter.setForeignStateAsync(bringNamespace + '.' + command, value, false);
}
//# sourceMappingURL=bring-io.js.map