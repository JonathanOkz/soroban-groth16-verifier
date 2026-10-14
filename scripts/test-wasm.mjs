import { execFileSync } from 'node:child_process';
import { builtWasmPath, projectRoot } from './io.mjs';
import { loadFixtures } from './fixtures.mjs';

await loadFixtures();
execFileSync('cargo', ['test', '--locked', '--lib', 'compiled_wasm_binds_the_public_input', '--', '--ignored'], {
  cwd: projectRoot, stdio: 'inherit', env: { ...process.env, DEMO_WASM: builtWasmPath() },
});
