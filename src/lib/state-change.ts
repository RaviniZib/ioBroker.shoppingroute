export function isAcknowledgedForeignState(state: { ack: boolean } | null | undefined): boolean {
    return state?.ack === true;
}
