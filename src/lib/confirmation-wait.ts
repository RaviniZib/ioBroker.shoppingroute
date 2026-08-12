export type ConfirmationResult = 'confirmed' | 'not-applied' | 'ambiguous';

export interface ConfirmationWaitOptions {
    timeoutMs: number;
    pollIntervalMs: number;
    probe: () => Promise<ConfirmationResult>;
    pause: (ms: number) => Promise<void>;
}

export async function waitForConfirmation(options: ConfirmationWaitOptions): Promise<ConfirmationResult> {
    const timeoutMs = Math.max(0, options.timeoutMs);
    const pollIntervalMs = Math.max(1, options.pollIntervalMs);
    let elapsedMs = 0;
    let latest: ConfirmationResult = 'ambiguous';

    while (true) {
        latest = await options.probe();
        if (latest === 'confirmed' || elapsedMs >= timeoutMs) return latest;

        const delayMs = Math.min(pollIntervalMs, timeoutMs - elapsedMs);
        await options.pause(delayMs);
        elapsedMs += delayMs;
    }
}
