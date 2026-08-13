"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createBufferedSortProgram = createBufferedSortProgram;
exports.classifyVisibleOrderFinalConfirmation = classifyVisibleOrderFinalConfirmation;
exports.sortIdsByAlexaUpdatedTime = sortIdsByAlexaUpdatedTime;
exports.createVisibleOrderRefreshPlan = createVisibleOrderRefreshPlan;
exports.createVisibleOrderTouchProgram = createVisibleOrderTouchProgram;
exports.createVisibleOrderMarker = createVisibleOrderMarker;
exports.createBufferedSortMarker = createBufferedSortMarker;
const EXACT_VISIBLE_ORDER_CIRCUIT_LIMIT = 12;
function advanceDesiredPrefix(desired, matched, ids) {
    let next = matched;
    for (const id of ids) {
        if (desired[next] === id)
            next += 1;
    }
    return next;
}
function rotateCircuit(circuit, start) {
    return circuit.slice(start).concat(circuit.slice(0, start));
}
function finalTouchIds(circuit, edges) {
    return [...circuit].reverse().map(edgeIndex => edges[edgeIndex].id);
}
function stepsForCircuits(circuits, edges, marker) {
    const steps = [];
    circuits.forEach((circuit, circuitIndex) => {
        const start = edges[circuit[0]];
        steps.push({ id: start.id, from: start.from, to: marker, kind: 'buffer', circuit: circuitIndex + 1 });
        for (let index = circuit.length - 1; index >= 1; index--) {
            const edge = edges[circuit[index]];
            steps.push({ id: edge.id, from: edge.from, to: edge.to, kind: 'rotate', circuit: circuitIndex + 1 });
        }
        steps.push({ id: start.id, from: marker, to: start.to, kind: 'final', circuit: circuitIndex + 1 });
    });
    return steps;
}
function prioritizedEulerCircuit(component, edges, startValue, desiredRank, newestFirst) {
    const unused = new Set(component);
    const outgoing = new Map();
    for (const edgeIndex of component) {
        const edge = edges[edgeIndex];
        const list = outgoing.get(edge.from) || [];
        list.push(edgeIndex);
        outgoing.set(edge.from, list);
    }
    for (const edgeIndexes of outgoing.values()) {
        edgeIndexes.sort((left, right) => {
            const difference = (desiredRank.get(edges[left].id) ?? 0) - (desiredRank.get(edges[right].id) ?? 0);
            return newestFirst ? difference : -difference;
        });
    }
    const vertexStack = [startValue];
    const edgeStack = [];
    const reverseCircuit = [];
    while (vertexStack.length > 0) {
        const value = vertexStack[vertexStack.length - 1];
        const edgeIndexes = outgoing.get(value) || [];
        while (edgeIndexes.length > 0 && !unused.has(edgeIndexes[edgeIndexes.length - 1]))
            edgeIndexes.pop();
        const edgeIndex = edgeIndexes.pop();
        if (edgeIndex !== undefined) {
            unused.delete(edgeIndex);
            edgeStack.push(edgeIndex);
            vertexStack.push(edges[edgeIndex].to);
        }
        else {
            vertexStack.pop();
            const previous = edgeStack.pop();
            if (previous !== undefined)
                reverseCircuit.push(previous);
        }
    }
    if (unused.size > 0 || reverseCircuit.length !== component.length)
        return [];
    return reverseCircuit.reverse();
}
function circuitCandidates(circuit, edges, desired) {
    const desiredRank = new Map(desired.map((id, index) => [id, index]));
    const candidates = new Map();
    candidates.set(circuit.join(','), circuit);
    const startValues = new Set(circuit.map(edgeIndex => edges[edgeIndex].from));
    for (const startValue of startValues) {
        for (const newestFirst of [false, true]) {
            const candidate = prioritizedEulerCircuit(circuit, edges, startValue, desiredRank, newestFirst);
            if (candidate.length === circuit.length)
                candidates.set(candidate.join(','), candidate);
        }
    }
    return [...candidates.values()];
}
function exactCircuitForDesiredPrefix(circuit, edges, desired, matched) {
    if (circuit.length > EXACT_VISIBLE_ORDER_CIRCUIT_LIMIT)
        return undefined;
    const localById = new Map(circuit.map((edgeIndex, localIndex) => [edges[edgeIndex].id, localIndex]));
    let targetLimit = matched;
    while (targetLimit < desired.length && localById.has(desired[targetLimit]))
        targetLimit += 1;
    const allMask = (1 << circuit.length) - 1;
    let bestMatched = matched;
    let bestReverseCircuit;
    let complete = false;
    for (let first = 0; first < circuit.length && !complete; first++) {
        const firstEdge = edges[circuit[first]];
        const firstMatched = desired[matched] === firstEdge.id ? matched + 1 : matched;
        const seen = new Map();
        const visit = (mask, last, currentMatched, sequence) => {
            if (complete)
                return;
            const key = `${mask}:${last}`;
            const previousMatched = seen.get(key);
            if (previousMatched !== undefined && previousMatched >= currentMatched)
                return;
            seen.set(key, currentMatched);
            if (mask === allMask) {
                const lastEdge = edges[circuit[last]];
                if (firstEdge.to !== lastEdge.from)
                    return;
                if (currentMatched > bestMatched) {
                    bestMatched = currentMatched;
                    bestReverseCircuit = [...sequence];
                    complete = currentMatched === targetLimit;
                }
                return;
            }
            const required = currentMatched < targetLimit
                ? localById.get(desired[currentMatched])
                : undefined;
            const canAdvance = required === undefined || (mask & (1 << required)) === 0;
            if (!canAdvance && bestMatched >= currentMatched)
                return;
            const lastEdge = edges[circuit[last]];
            const candidates = [];
            for (let next = 0; next < circuit.length; next++) {
                if ((mask & (1 << next)) === 0 && edges[circuit[next]].to === lastEdge.from)
                    candidates.push(next);
            }
            candidates.sort((left, right) => {
                const wanted = canAdvance ? desired[currentMatched] : undefined;
                const leftWanted = edges[circuit[left]].id === wanted ? 1 : 0;
                const rightWanted = edges[circuit[right]].id === wanted ? 1 : 0;
                return rightWanted - leftWanted;
            });
            for (const next of candidates) {
                const edge = edges[circuit[next]];
                visit(mask | (1 << next), next, canAdvance && edge.id === desired[currentMatched] ? currentMatched + 1 : currentMatched, sequence.concat(next));
            }
        };
        visit(1 << first, first, firstMatched, [first]);
    }
    if (!bestReverseCircuit)
        return undefined;
    return bestReverseCircuit.reverse().map(localIndex => circuit[localIndex]);
}
function optimizeCircuitsForVisibleOrder(circuits, edges, preference) {
    if (!preference || circuits.length === 0)
        return circuits;
    const current = preference.currentOrderIds.map(String);
    const desired = preference.desiredOrderIds.map(String);
    const currentSet = new Set(current);
    if (current.length !== desired.length ||
        currentSet.size !== current.length ||
        new Set(desired).size !== desired.length ||
        desired.some(id => !currentSet.has(id))) {
        throw new Error('Sichtbare Sortierreihenfolge enthält nicht dieselben eindeutigen IDs.');
    }
    const circuitById = new Map();
    circuits.forEach((circuit, circuitIndex) => {
        for (const edgeIndex of circuit)
            circuitById.set(edges[edgeIndex].id, circuitIndex);
    });
    const changedIds = new Set(circuitById.keys());
    const unchangedOrder = current.filter(id => !changedIds.has(id));
    let matched = advanceDesiredPrefix(desired, 0, unchangedOrder);
    const used = new Set();
    const optimized = [];
    // A circuit is one indivisible marker transaction. The circuit containing the next unmatched target ID is the
    // only block that can extend the preserved prefix. Try deterministic target-prioritized Euler traversals and
    // every safe rotation; placing any other circuit first could only skip its IDs permanently.
    while (matched < desired.length) {
        const circuitIndex = circuitById.get(desired[matched]);
        if (circuitIndex === undefined || used.has(circuitIndex))
            break;
        const circuit = circuits[circuitIndex];
        let bestCircuit = circuit;
        let bestMatched = matched;
        const candidates = circuitCandidates(circuit, edges, desired);
        const exactCandidate = exactCircuitForDesiredPrefix(circuit, edges, desired, matched);
        if (exactCandidate)
            candidates.push(exactCandidate);
        for (const baseCandidate of candidates) {
            for (let start = 0; start < baseCandidate.length; start++) {
                const candidate = rotateCircuit(baseCandidate, start);
                const candidateMatched = advanceDesiredPrefix(desired, matched, finalTouchIds(candidate, edges));
                if (candidateMatched > bestMatched) {
                    bestCircuit = candidate;
                    bestMatched = candidateMatched;
                }
            }
        }
        if (bestMatched === matched)
            break;
        optimized.push(bestCircuit);
        used.add(circuitIndex);
        matched = bestMatched;
    }
    circuits.forEach((circuit, circuitIndex) => {
        if (!used.has(circuitIndex))
            optimized.push(circuit);
    });
    return optimized;
}
function countValues(values) {
    const counts = new Map();
    for (const value of values)
        counts.set(value, (counts.get(value) || 0) + 1);
    return counts;
}
function sameValueCounts(left, right) {
    if (left.size !== right.size)
        return false;
    for (const [value, count] of left) {
        if (right.get(value) !== count)
            return false;
    }
    return true;
}
function createBufferedSortProgram(plan, marker, visibleOrderPreference) {
    const bufferMarker = String(marker || '').trim();
    if (!bufferMarker)
        throw new Error('Sortierpuffer darf nicht leer sein.');
    const sourceValues = plan.map(entry => String(entry.from));
    const targetValues = plan.map(entry => String(entry.to));
    if (sourceValues.includes(bufferMarker) || targetValues.includes(bufferMarker)) {
        throw new Error('Sortierpuffer kollidiert mit einem vorhandenen Listentext.');
    }
    if (!sameValueCounts(countValues(sourceValues), countValues(targetValues))) {
        throw new Error('Sortierplan ist keine reine Permutation der vorhandenen Listentexte.');
    }
    const edges = plan
        .map((entry, index) => ({
        index,
        id: String(entry.id),
        from: String(entry.from),
        to: String(entry.to),
        position: Number(entry.position) || index + 1,
    }))
        .filter(entry => entry.from !== entry.to);
    if (edges.length === 0) {
        return { marker: bufferMarker, changedSlots: 0, circuits: 0, amazonWrites: 0, steps: [] };
    }
    const outgoing = new Map();
    const indegree = new Map();
    const outdegree = new Map();
    for (let index = 0; index < edges.length; index++) {
        const edge = edges[index];
        const list = outgoing.get(edge.from) || [];
        list.push(index);
        outgoing.set(edge.from, list);
        outdegree.set(edge.from, (outdegree.get(edge.from) || 0) + 1);
        indegree.set(edge.to, (indegree.get(edge.to) || 0) + 1);
    }
    const values = new Set([...indegree.keys(), ...outdegree.keys()]);
    for (const value of values) {
        if ((indegree.get(value) || 0) !== (outdegree.get(value) || 0)) {
            throw new Error(`Sortierplan ist bei „${value}“ nicht ausgeglichen.`);
        }
    }
    // pop() soll deterministisch den ältesten Slot zuerst liefern.
    for (const edgeIndexes of outgoing.values()) {
        edgeIndexes.sort((left, right) => (edges[right].position - edges[left].position) || (right - left));
    }
    const unused = new Set(edges.map((_edge, index) => index));
    const circuits = [];
    const takeOutgoing = (value) => {
        const edgeIndexes = outgoing.get(value) || [];
        while (edgeIndexes.length > 0 && !unused.has(edgeIndexes[edgeIndexes.length - 1]))
            edgeIndexes.pop();
        if (edgeIndexes.length === 0)
            return undefined;
        const index = edgeIndexes.pop();
        if (index === undefined)
            return undefined;
        unused.delete(index);
        return index;
    };
    while (unused.size > 0) {
        let first;
        for (const index of unused) {
            if (first === undefined ||
                edges[index].position < edges[first].position ||
                (edges[index].position === edges[first].position && index < first))
                first = index;
        }
        if (first === undefined)
            break;
        const vertexStack = [edges[first].from];
        const edgeStack = [];
        const reverseCircuit = [];
        while (vertexStack.length > 0) {
            const value = vertexStack[vertexStack.length - 1];
            const edgeIndex = takeOutgoing(value);
            if (edgeIndex !== undefined) {
                edgeStack.push(edgeIndex);
                vertexStack.push(edges[edgeIndex].to);
            }
            else {
                vertexStack.pop();
                if (edgeStack.length > 0) {
                    const previous = edgeStack.pop();
                    if (previous !== undefined)
                        reverseCircuit.push(previous);
                }
            }
        }
        const circuit = reverseCircuit.reverse();
        if (circuit.length < 2)
            throw new Error('Ungültiger Sortierkreis mit weniger als zwei Änderungen.');
        for (let index = 0; index < circuit.length; index++) {
            const current = edges[circuit[index]];
            const next = edges[circuit[(index + 1) % circuit.length]];
            if (current.to !== next.from)
                throw new Error('Sortierkreis ist intern nicht geschlossen.');
        }
        circuits.push(circuit);
    }
    const optimizedCircuits = optimizeCircuitsForVisibleOrder(circuits, edges, visibleOrderPreference);
    const steps = stepsForCircuits(optimizedCircuits, edges, bufferMarker);
    return {
        marker: bufferMarker,
        changedSlots: edges.length,
        circuits: circuits.length,
        amazonWrites: steps.length,
        steps,
    };
}
function classifyVisibleOrderFinalConfirmation(expectedValue, marker, previousUpdatedDateTime, listValue, currentUpdatedDateTime, stateValue, stateAcknowledged) {
    const previousUpdated = previousUpdatedDateTime === undefined ? '' : String(previousUpdatedDateTime);
    const currentUpdated = currentUpdatedDateTime === undefined ? '' : String(currentUpdatedDateTime);
    if (listValue === expectedValue &&
        currentUpdated !== '' &&
        currentUpdated !== previousUpdated)
        return 'confirmed';
    if (listValue === marker && stateValue === marker && stateAcknowledged)
        return 'not-applied';
    return 'ambiguous';
}
function visibleOrderTimestamp(value) {
    if (typeof value === 'number' && Number.isFinite(value))
        return value;
    if (typeof value === 'string' && value.trim()) {
        const numeric = Number(value);
        if (Number.isFinite(numeric))
            return numeric;
        const parsed = Date.parse(value);
        if (Number.isFinite(parsed))
            return parsed;
    }
    return 0;
}
function sortIdsByAlexaUpdatedTime(items) {
    return [...items]
        .sort((left, right) => {
        const leftUpdated = visibleOrderTimestamp(left.updatedDateTime) || visibleOrderTimestamp(left.createdDateTime);
        const rightUpdated = visibleOrderTimestamp(right.updatedDateTime) || visibleOrderTimestamp(right.createdDateTime);
        if (leftUpdated !== rightUpdated)
            return leftUpdated - rightUpdated;
        const leftCreated = visibleOrderTimestamp(left.createdDateTime);
        const rightCreated = visibleOrderTimestamp(right.createdDateTime);
        if (leftCreated !== rightCreated)
            return leftCreated - rightCreated;
        return String(left.id).localeCompare(String(right.id));
    })
        .map(item => String(item.id));
}
function createVisibleOrderRefreshPlan(currentOrderIds, desiredOrderIds) {
    const current = currentOrderIds.map(String);
    const desired = desiredOrderIds.map(String);
    if (new Set(current).size !== current.length || new Set(desired).size !== desired.length) {
        throw new Error('Sichtbare Sortierreihenfolge enthält doppelte IDs.');
    }
    if (current.length !== desired.length) {
        throw new Error('Sichtbare Sortierreihenfolge enthält nicht dieselben IDs wie der Sortierplan.');
    }
    const currentSet = new Set(current);
    if (desired.some(id => !currentSet.has(id))) {
        throw new Error('Sichtbare Sortierreihenfolge enthält nicht dieselben IDs wie der Sortierplan.');
    }
    let currentIndex = 0;
    let keepPrefix = 0;
    for (; keepPrefix < desired.length; keepPrefix++) {
        const wanted = desired[keepPrefix];
        let found = -1;
        for (let index = currentIndex; index < current.length; index++) {
            if (current[index] === wanted) {
                found = index;
                break;
            }
        }
        if (found < 0)
            break;
        currentIndex = found + 1;
    }
    return desired.slice(keepPrefix);
}
function createVisibleOrderTouchProgram(id, value, marker) {
    const itemId = String(id || '').trim();
    const itemValue = String(value || '').trim();
    const bufferMarker = String(marker || '').trim();
    if (!itemId)
        throw new Error('Reihenfolge-Aktualisierung benötigt eine Eintrags-ID.');
    if (!itemValue)
        throw new Error('Reihenfolge-Aktualisierung benötigt einen sichtbaren Text.');
    if (!bufferMarker)
        throw new Error('Reihenfolge-Aktualisierung benötigt einen Puffermarker.');
    if (itemValue === bufferMarker)
        throw new Error('Reihenfolge-Puffermarker kollidiert mit dem sichtbaren Text.');
    return {
        marker: bufferMarker,
        changedSlots: 1,
        circuits: 1,
        amazonWrites: 2,
        steps: [
            { id: itemId, from: itemValue, to: bufferMarker, kind: 'buffer', circuit: 1 },
            { id: itemId, from: bufferMarker, to: itemValue, kind: 'final', circuit: 1 },
        ],
    };
}
function createVisibleOrderMarker(transactionId, step, existingValues) {
    const token = String(transactionId || '').replace(/[^A-Za-z0-9]/g, '');
    if (!token)
        throw new Error('Reihenfolge-Marker benötigt eine alphanumerische Transaktionskennung.');
    const stepNumber = Math.max(0, Math.floor(Number(step) || 0));
    const existing = new Set([...existingValues].map(value => String(value || '').trim()));
    const base = `ShoppingRoute Reihenfolge ${token} ${stepNumber}`;
    let marker = base;
    let collision = 0;
    while (existing.has(marker)) {
        collision += 1;
        marker = `${base} ${collision}`;
    }
    return marker;
}
function createBufferedSortMarker(transactionId, step, existingValues) {
    const token = String(transactionId || '').replace(/[^A-Za-z0-9]/g, '');
    if (!token)
        throw new Error('Sortierpuffer-Marker benötigt eine alphanumerische Transaktionskennung.');
    const stepNumber = Math.max(0, Math.floor(Number(step) || 0));
    const existing = new Set([...existingValues].map(value => String(value || '').trim()));
    const base = `ShoppingRoute Puffer ${token} ${stepNumber}`;
    let marker = base;
    let collision = 0;
    while (existing.has(marker)) {
        collision += 1;
        marker = `${base} ${collision}`;
    }
    return marker;
}
//# sourceMappingURL=buffered-sort.js.map