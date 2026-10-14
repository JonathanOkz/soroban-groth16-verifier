import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const projectRoot = fileURLToPath(new URL('../', import.meta.url));

export const sha256Hex = bytes => createHash('sha256').update(bytes).digest('hex');
export const readJson = async path => JSON.parse(await readFile(path, 'utf8'));
export const writeJson = (path, value) => writeFile(path, JSON.stringify(value, null, 2) + '\n');

export function builtWasmPath() {
  const metadata = JSON.parse(execFileSync('cargo', ['metadata', '--locked', '--no-deps', '--format-version', '1'], {
    cwd: projectRoot, encoding: 'utf8',
  }));
  return join(metadata.target_directory, 'wasm32v1-none/release/proof_verifier.wasm');
}
