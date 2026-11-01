(function(root) {
"use strict";
// Auditable JSON graph codec: preserves insertion order, aliases, holes, undefined,
// non-finite numbers and -0. Rejects executable/custom objects instead of losing them.
function encode(value) {
  const nodes = [], seen = new Map();
  function visit(v, depth = 0) {
    if (depth > 256 || nodes.length > 200000) throw new Error('Snapshot complexity limit');
    if (v === null) return ['null'];
    if (v === undefined) return ['undefined'];
    if (typeof v === 'number') return ['number', Number.isNaN(v) ? 'NaN' : v === Infinity ? '+Infinity' : v === -Infinity ? '-Infinity' : Object.is(v, -0) ? '-0' : v];
    if (typeof v === 'string' || typeof v === 'boolean') return [typeof v, v];
    if (typeof v !== 'object') throw new Error(`Unsupported snapshot value: ${typeof v}`);
    if (seen.has(v)) return ['ref', seen.get(v)];
    const proto = Object.getPrototypeOf(v), array = Array.isArray(v);
    if (!array && proto !== Object.prototype && proto !== null) throw new Error('Unsupported snapshot object prototype');
    if (Object.getOwnPropertySymbols(v).length) throw new Error('Snapshot symbol keys unsupported');
    const id = nodes.length; seen.set(v, id);
    const node = { kind: array ? 'array' : proto === null ? 'null-object' : 'object', entries: [] };
    if (array) node.length = v.length;
    nodes.push(node);
    for (const key of Object.getOwnPropertyNames(v)) {
      if (array && key === 'length') continue;
      const d = Object.getOwnPropertyDescriptor(v, key);
      if (d.get || d.set || !d.enumerable) throw new Error('Snapshot accessors/non-enumerable fields unsupported');
      node.entries.push([key, visit(d.value, depth + 1)]);
    }
    return ['ref', id];
  }
  const root = visit(value); return { codec: 'emissary-state-graph-v1', root, nodes };
}
function decode(data) {
  if (data?.codec !== 'emissary-state-graph-v1' || !Array.isArray(data.nodes) || data.nodes.length > 200000) throw new Error('Unsupported snapshot codec');
  const values = data.nodes.map(n => {
    if (n.kind === 'array' && Number.isSafeInteger(n.length) && n.length >= 0 && n.length <= 1000000) return new Array(n.length);
    if (n.kind === 'object') return {};
    if (n.kind === 'null-object') return Object.create(null);
    throw new Error('Invalid snapshot node');
  });
  function read(v) {
    if (!Array.isArray(v)) throw new Error('Invalid snapshot value');
    switch (v[0]) {
      case 'null': return null;
      case 'undefined': return undefined;
      case 'string': if (typeof v[1] === 'string') return v[1]; break;
      case 'boolean': if (typeof v[1] === 'boolean') return v[1]; break;
      case 'number': if (typeof v[1] === 'number' && Number.isFinite(v[1])) return v[1];
        if (Object.hasOwn({NaN:1,'+Infinity':1,'-Infinity':1,'-0':1},v[1])) return {NaN:NaN,'+Infinity':Infinity,'-Infinity':-Infinity,'-0':-0}[v[1]]; break;
      case 'ref': if (Number.isInteger(v[1]) && v[1] >= 0 && v[1] < values.length) return values[v[1]]; break;
    }
    throw new Error('Invalid snapshot value');
  }
  data.nodes.forEach((n, i) => {
    if (!Array.isArray(n.entries)) throw new Error('Invalid snapshot entries');
    const keys = new Set();
    for (const [key, v] of n.entries) {
      if (typeof key !== 'string' || keys.has(key) || (n.kind === 'array' && key === 'length')) throw new Error('Invalid snapshot key');
      keys.add(key); Object.defineProperty(values[i],key,{value:read(v),enumerable:true,writable:true,configurable:true});
    }
  });
  return read(data.root);
}

const api = {encode,decode}; if (typeof module === "object" && module.exports) module.exports=api; else root.ConceptCombatDecisionCodec=api;
})(globalThis);
