export interface BringStateWriter {
    setForeignStateAsync(id: string, value: string, ack: boolean): Promise<void>;
}

/** Writes exclusively to documented Bring! adapter commands; never to Alexa2 states. */
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
