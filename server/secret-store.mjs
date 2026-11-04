import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const PS_PROTECT = `$b=[Console]::In.ReadToEnd(); Add-Type -AssemblyName System.Security; $enc=[Security.Cryptography.ProtectedData]::Protect([Text.Encoding]::UTF8.GetBytes($b),$null,'CurrentUser'); [Convert]::ToBase64String($enc)`;
const PS_UNPROTECT = `$b=[Console]::In.ReadToEnd(); Add-Type -AssemblyName System.Security; $raw=[Convert]::FromBase64String($b); [Text.Encoding]::UTF8.GetString([Security.Cryptography.ProtectedData]::Unprotect($raw,$null,'CurrentUser'))`;

function runPowerShell(script, input) {
  const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
    input: String(input || ''),
    encoding: 'utf8',
    windowsHide: true,
    timeout: 15000,
  });
  if (result.status !== 0) throw new Error(String(result.stderr || 'DPAPI failed').trim());
  return String(result.stdout || '').trim();
}

export function createSecretStore({ dataDir, platform = process.platform } = {}) {
  const file = path.join(dataDir, 'model-secret.json');
  let cache = null;

  function load() {
    if (cache) return cache;
    try {
      const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (parsed?.protection === 'dpapi' && parsed.payload) return (cache = { apiKey: runPowerShell(PS_UNPROTECT, parsed.payload) });
      if (parsed?.protection === 'file' && parsed.apiKey) return (cache = { apiKey: String(parsed.apiKey) });
      if (typeof parsed?.apiKey === 'string' && parsed.apiKey) return (cache = { apiKey: parsed.apiKey });
    } catch {}
    return (cache = {});
  }

  function write(payload) {
    const temp = file + '.tmp';
    fs.writeFileSync(temp, JSON.stringify(payload), { encoding: 'utf8', mode: 0o600 });
    fs.renameSync(temp, file);
  }

  function set(apiKey) {
    const value = String(apiKey || '');
    if (!value) return clear();
    let payload = { version: 1, protection: 'file', apiKey: value };
    if (platform === 'win32') {
      try { payload = { version: 1, protection: 'dpapi', payload: runPowerShell(PS_PROTECT, value) }; } catch {}
    }
    write(payload);
    cache = { apiKey: value };
    return cache;
  }

  function clear() {
    fs.rmSync(file, { force: true });
    cache = {};
    return cache;
  }

  return { file, load, set, clear, get: () => String(load().apiKey || '') };
}