export interface BringStateWriter {
    setForeignStateAsync(id: string, value: string, ack: boolean): Promise<unknown>;
}

/**
 * Writes exclusively to documented Bring! commands; never to Alexa2 states.
 *
 * @param adapter An ioBroker adapter with foreign state write access.
 * @param bringNamespace A validated Bring! list state namespace.
 * @param command A supported Bring! adapter command.
 * @param value Item name, optionally followed by comma-separated specifications.
 */
export async function sendBringCommand(
    adapter: BringStateWriter, bringNamespace: string,
    command: 'saveItem' | 'moveToRecentContent', value: string,
): Promise<void> {
    if (!/^bring\.\d+\.[\da-f-]{36}$/i.test(bringNamespace)) {
        throw new Error('Invalid Bring! list namespace.');
    }
    if (!String(value || '').trim()) throw new Error('Empty Bring! command.');
    await adapter.setForeignStateAsync(bringNamespace + '.' + command, value, false);
}
