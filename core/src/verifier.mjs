// Verification is code, not model self-report.
import fs from 'node:fs';

/**
 * Create a verifier for file, HTTP, exit-code, result, and custom checks.
 */
export function createVerifier({ checks = {} } = {}) {
  function verify(kind, payload = {}, criteria = []) {
    const evidence = [];
    const failures = [];
    const k = String(kind || 'generic');
    let ok = true;

    if (k === 'noop') {
      ok = true;
      evidence.push('noop');
    } else if (k === 'file') {
      const file = String(payload.file || '');
      ok = Boolean(file) && fs.existsSync(file);
      evidence.push({ type: 'file', file, exists: ok });
      if (!ok) failures.push(`file missing: ${file}`);
    } else if (k === 'http') {
      const status = Number(payload.status);
      ok = Number.isFinite(status) && status >= 200 && status < 400;
      evidence.push({ type: 'http', status });
      if (!ok) failures.push(`http status: ${payload.status}`);
    } else if (k === 'exit') {
      const code = Number(payload.exitCode);
      ok = code === 0;
      evidence.push({ type: 'exit', code });
      if (!ok) failures.push(`exit code: ${payload.exitCode}`);
    } else if (k === 'result') {
      ok = payload.ok === true;
      evidence.push({ type: 'result', ok: payload.ok === true });
      if (!ok) failures.push(`result not ok: ${payload.error || payload.reason || ''}`);
    } else if (typeof checks[k] === 'function') {
      const result = checks[k](payload);
      ok = result?.ok === true;
      if (result?.evidence) evidence.push(result.evidence);
      if (!ok) failures.push(result?.error || `verification failed: ${k}`);
    } else {
      // Generic contract: explicit ok boolean + optional evidence.
      ok = payload.ok !== false;
      evidence.push({ type: 'generic', ok });
    }

    const wanted = (Array.isArray(criteria) ? criteria : []).map(String);
    for (const item of wanted) {
      if (item.startsWith('file:')) {
        const file = item.slice(5);
        const exists = fs.existsSync(file);
        evidence.push({ type: 'file', file, exists });
        if (!exists) { ok = false; failures.push(`file missing: ${file}`); }
      } else if (item.startsWith('evidence:')) {
        const min = Number(item.slice(9)) || 1;
        if (evidence.length < min) { ok = false; failures.push(`evidence < ${min}`); }
      }
    }
    return { ok, kind: k, evidence, failures };
  }

  return { verify };
}
