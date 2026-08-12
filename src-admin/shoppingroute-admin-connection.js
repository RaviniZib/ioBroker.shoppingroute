'use strict';

/* eslint-disable jsdoc/require-jsdoc */
/* global window */

let socketPromise;

function versionAtLeast(version, minimum) {
    const current = String(version || '')
        .split('.')
        .map(value => parseInt(value, 10) || 0);
    const wanted = String(minimum || '')
        .split('.')
        .map(value => parseInt(value, 10) || 0);

    for (let index = 0; index < Math.max(current.length, wanted.length); index++) {
        const left = current[index] || 0;
        const right = wanted[index] || 0;
        if (left > right) {
            return true;
        }
        if (left < right) {
            return false;
        }
    }

    return true;
}

function connectIoBroker() {
    if (socketPromise) {
        return socketPromise;
    }

    socketPromise = new Promise((resolve, reject) => {
        const socketLibrary = window.io || window.iob;
        if (!socketLibrary || typeof socketLibrary.connect !== 'function') {
            reject(new Error('ioBroker Socket-Bibliothek ist nicht verfügbar'));
            return;
        }

        let finished = false;
        const done = socket => {
            if (!finished) {
                finished = true;
                resolve(socket);
            }
        };
        const fail = error => {
            if (!finished) {
                finished = true;
                reject(error instanceof Error ? error : new Error(String(error || 'Socket-Verbindungsfehler')));
            }
        };

        const socket = socketLibrary.connect(window.location.origin, {
            path: '/socket.io',
            query: 'ws=true',
            name: 'shoppingroute-admin',
            timeout: 20000,
        });

        socket.on('connect_error', fail);
        socket.on('connect', legacyAuthenticated => {
            if (legacyAuthenticated === true) {
                done(socket);
                return;
            }

            socket.emit('getVersion', (first, second) => {
                let error = null;
                let version = '';

                if (typeof first === 'string' && /^\d+\.\d+\.\d+/.test(first) && !second) {
                    version = first;
                } else {
                    error = first;
                    version = second || '';
                }

                if (error) {
                    fail(error);
                    return;
                }

                if (version && versionAtLeast(version, '4.1.2')) {
                    socket.emit('authenticate', authError => {
                        if (authError) {
                            fail(authError);
                            return;
                        }
                        done(socket);
                    });
                } else {
                    done(socket);
                }
            });
        });
    });

    return socketPromise;
}

function queryParam(name) {
    return new URLSearchParams(window.location.search || '').get(name) || '';
}

function namespaceFromProps(props) {
    const fromProps =
        typeof props?.instance === 'string'
            ? props.instance
            : typeof props?.instance === 'number'
              ? `shoppingroute.${props.instance}`
              : '';
    const fromQuery = queryParam('instance') || queryParam('adapterInstance') || queryParam('id');
    const raw = fromProps || fromQuery || 'shoppingroute.0';
    return raw.startsWith('system.adapter.') ? raw.slice('system.adapter.'.length) : raw;
}

function emitWithCallback(event, args) {
    return connectIoBroker().then(
        socket =>
            new Promise((resolve, reject) => {
                socket.emit(event, ...args, (...callbackArgs) => {
                    if (!callbackArgs.length) {
                        resolve(undefined);
                        return;
                    }
                    const [first, second] = callbackArgs;
                    if (first && (typeof first !== 'string' || !Array.isArray(second))) {
                        reject(first instanceof Error ? first : new Error(String(first)));
                        return;
                    }
                    resolve(second === undefined ? first : second);
                });
            }),
    );
}

function getState(id) {
    return connectIoBroker().then(
        socket =>
            new Promise((resolve, reject) => {
                socket.emit('getState', id, (error, state) => {
                    if (error) {
                        reject(new Error(String(error)));
                        return;
                    }
                    resolve(state || null);
                });
            }),
    );
}

function setState(id, value) {
    return connectIoBroker().then(
        socket =>
            new Promise((resolve, reject) => {
                socket.emit('setState', id, { val: value, ack: false }, error => {
                    if (error) {
                        reject(new Error(String(error)));
                        return;
                    }
                    resolve();
                });
            }),
    );
}

function sendTo(props, command, message) {
    return connectIoBroker().then(
        socket =>
            new Promise((resolve, reject) => {
                socket.emit('sendTo', namespaceFromProps(props), command, message, result => {
                    resolve(result);
                });
                socket.once('error', error => {
                    reject(error instanceof Error ? error : new Error(String(error)));
                });
            }),
    );
}

function getAdapterInstances(adapter) {
    return emitWithCallback('getObjectView', [
        'system',
        'instance',
        {
            startkey: `system.adapter.${adapter}.`,
            endkey: `system.adapter.${adapter}.\u9999`,
        },
    ]).then(result => {
        const rows = Array.isArray(result?.rows) ? result.rows : [];
        return rows
            .map(row => ({
                id: String(row?.id || '').replace(/^system\.adapter\./, ''),
                enabled: row?.value?.common?.enabled !== false,
            }))
            .filter(entry => entry.enabled !== false && entry.id);
    });
}

module.exports = {
    connectIoBroker,
    getAdapterInstances,
    getState,
    namespaceFromProps,
    queryParam,
    sendTo,
    setState,
};
