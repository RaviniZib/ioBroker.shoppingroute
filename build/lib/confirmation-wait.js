"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.waitForConfirmation = waitForConfirmation;
async function waitForConfirmation(options) {
    const timeoutMs = Math.max(0, options.timeoutMs);
    const pollIntervalMs = Math.max(1, options.pollIntervalMs);
    let elapsedMs = 0;
    let latest = 'ambiguous';
    while (true) {
        latest = await options.probe();
        if (latest === 'confirmed' || elapsedMs >= timeoutMs)
            return latest;
        const delayMs = Math.min(pollIntervalMs, timeoutMs - elapsedMs);
        await options.pause(delayMs);
        elapsedMs += delayMs;
    }
}
//# sourceMappingURL=confirmation-wait.js.map