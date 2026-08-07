"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.inspectAlexaRemoteSource = inspectAlexaRemoteSource;
exports.canWriteAlexa = canWriteAlexa;
function inspectAlexaRemoteSource(source) {
    const text = String(source || '');
    if (/\?version\s+=\$\{options\.version\}/.test(text)) {
        return {
            status: 'known-bug',
            detail: 'Bekannter updateListItem-Fehler gefunden: Leerzeichen vor dem Gleichheitszeichen in der version-Query.',
        };
    }
    if (/\?version=\$\{options\.version\}/.test(text)) {
        return {
            status: 'source-ok',
            detail: 'Die bekannte fehlerhafte version-Query wurde in der installierten alexa-remote2-Quelle nicht gefunden; die korrigierte Schreibweise ist vorhanden.',
        };
    }
    return {
        status: 'unknown',
        detail: 'Die installierte alexa-remote2-Quelle konnte nicht eindeutig als kompatibel oder als bekannte fehlerhafte Variante erkannt werden.',
    };
}
function canWriteAlexa(capability) {
    return capability === 'source-ok' || capability === 'live-ok';
}
//# sourceMappingURL=compatibility.js.map