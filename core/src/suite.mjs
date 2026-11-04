// Minimal deterministic eval suite runner. No process spawning, no model judge.
export async function runSuite(tests = [], { timeoutMs = 5000, onResult = () => {} } = {}) {
  const results = [];
  for (const entry of Array.isArray(tests) ? tests : []) {
    const name = String(entry?.name || `test_${results.length}`);
    const fn = entry?.run || entry?.fn;
    if (typeof fn !== 'function') {
      const result = { name, ok: false, ms: 0, error: 'test function required' };
      results.push(result); onResult(result); continue;
    }
    const started = Date.now();
    let timer;
    try {
      await Promise.race([
        Promise.resolve().then(fn),
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error(`test timeout: ${name}`)), Math.max(100, Number(timeoutMs) || 5000));
        }),
      ]);
      const result = { name, ok: true, ms: Date.now() - started };
      results.push(result); onResult(result);
    } catch (error) {
      const result = { name, ok: false, ms: Date.now() - started, error: String(error?.message || error) };
      results.push(result); onResult(result);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
  const failed = results.filter((r) => !r.ok).length;
  return { ok: failed === 0, total: results.length, passed: results.length - failed, failed, results };
}