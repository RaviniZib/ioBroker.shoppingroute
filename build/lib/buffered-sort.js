"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createBufferedSortProgram = createBufferedSortProgram;
exports.sortIdsByAlexaUpdatedTime = sortIdsByAlexaUpdatedTime;
exports.createVisibleOrderRefreshPlan = createVisibleOrderRefreshPlan;
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
function createBufferedSortProgram(plan, marker) {
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
    const steps = [];
    circuits.forEach((circuit, circuitIndex) => {
        const start = edges[circuit[0]];
        steps.push({ id: start.id, from: start.from, to: bufferMarker, kind: 'buffer', circuit: circuitIndex + 1 });
        for (let index = circuit.length - 1; index >= 1; index--) {
            const edge = edges[circuit[index]];
            steps.push({ id: edge.id, from: edge.from, to: edge.to, kind: 'rotate', circuit: circuitIndex + 1 });
        }
        steps.push({ id: start.id, from: bufferMarker, to: start.to, kind: 'final', circuit: circuitIndex + 1 });
    });
    return {
        marker: bufferMarker,
        changedSlots: edges.length,
        circuits: circuits.length,
        amazonWrites: steps.length,
        steps,
    };
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
//# sourceMappingURL=buffered-sort.js.map