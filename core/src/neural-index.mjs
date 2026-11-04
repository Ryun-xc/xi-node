// Optional bridge from cognitive memory records to the existing neural graph.
// Only observed + active records are indexed; pending/inferred stay out.
import { readJson, atomicJson } from './storage.mjs';

/**
 * Create an optional memory-to-graph index. Only observed active records are indexed.
 */
export function createNeuralIndex({ file, logger = () => {} } = {}) {
  if (!file) throw new Error('neural graph file required');
  function upsert(record) {
    if (!record || record.status !== 'active' || record.provenance?.epistemic !== 'observed') return null;
    const graph = readJson(file, { nodes: [], edges: [] });
    const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
    const id = `memory:${record.id}`;
    const node = {
      id,
      type: record.kind === 'procedural' ? 'skill' : 'fact',
      text: String(record.text || '').slice(0, 4000),
      scope: record.scope || 'global',
      source: 'cognitive',
      epistemic: 'observed',
      confidence: Number(record.provenance?.confidence) || 0.5,
      evidence: record.provenance?.evidence || [],
      reviewStatus: 'approved',
      createdAt: record.createdAt || Date.now(),
      retention: 0.5,
      accessCount: 0,
    };
    const index = nodes.findIndex((n) => n.id === id);
    if (index >= 0) nodes[index] = { ...nodes[index], ...node };
    else nodes.push(node);
    graph.nodes = nodes;
    if (!Array.isArray(graph.edges)) graph.edges = [];
    graph.updatedAt = new Date().toISOString();
    atomicJson(file, graph);
    return node;
  }
  function remove(recordId) {
    const graph = readJson(file, { nodes: [], edges: [] });
    const id = `memory:${recordId}`;
    const before = (graph.nodes || []).length;
    graph.nodes = (graph.nodes || []).filter((n) => n.id !== id);
    if (graph.nodes.length === before) return false;
    graph.edges = (graph.edges || []).filter((e) => e.from !== id && e.to !== id);
    graph.updatedAt = new Date().toISOString();
    atomicJson(file, graph);
    return true;
  }
  function list() {
    const graph = readJson(file, { nodes: [] });
    return (graph.nodes || []).filter((n) => n.source === 'cognitive');
  }
  return { upsert, remove, list, file };
}
