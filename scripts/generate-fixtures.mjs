import { randomBytes } from 'node:crypto';
import { mkdir, writeFile, copyFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { powersOfTau, zKey, groth16 } from 'snarkjs';
import { encodeVerificationKey, encodeProof } from './encoding.mjs';
import { projectRoot as root, writeJson } from './io.mjs';
import { witnesses, cases } from './fixtures.mjs';

const rustKeyPath = 'contracts/proof-verifier/src/verification_key.rs';

function renderRustKey(constants) {
  const declarations = Object.entries(constants).map(([name, bytes]) =>
    `pub const ${name}: [u8; ${bytes.length}] = [${[...bytes].join(', ')}];`);
  return execFileSync('rustfmt', ['--edition', '2024', '--emit', 'stdout'], {
    cwd: root, encoding: 'utf8',
    input: ['// Generated from fixtures/verification_key.json.', ...declarations, ''].join('\n'),
  });
}

const circom = process.env.CIRCOM ?? 'circom';
const circomVersion = '2.2.3';
const cli = join(root, 'node_modules/snarkjs/build/cli.cjs');
const snarkjsCli = (...args) => execFileSync(process.execPath, [cli, ...args], { stdio: 'inherit' });
const entropy = () => randomBytes(64).toString('hex');

if (!process.argv[2]) throw new Error('Usage: npm run fixtures -- <output-directory>');
const output = resolve(process.argv[2]);
await mkdir(output, { recursive: true });
const work = join(output, '.work');
const scratch = name => join(work, name);
const published = name => join(output, 'fixtures', name);
for (const name of ['.work', 'circuits', 'fixtures']) {
  await mkdir(join(output, name), { recursive: true });
}
await mkdir(dirname(join(output, rustKeyPath)), { recursive: true });
const circuitPath = join(output, 'circuits/multiplier.circom');
await copyFile(join(root, 'circuits/multiplier.circom'), circuitPath);
if (execFileSync(circom, ['--version'], { encoding: 'utf8' }).trim() !== `circom compiler ${circomVersion}`) {
  console.warn(`Expected Circom ${circomVersion}; continuing with the installed version`);
}
execFileSync(circom, [circuitPath, '--r1cs', '--wasm', '--O1', '-o', work], { stdio: 'inherit' });

snarkjsCli('powersoftau', 'new', 'bn128', '8', scratch('initial.ptau'));
await powersOfTau.contribute(scratch('initial.ptau'), scratch('contributed.ptau'), 'Local demo contribution', entropy());
await powersOfTau.preparePhase2(scratch('contributed.ptau'), scratch('phase2.ptau'));
snarkjsCli('powersoftau', 'verify', scratch('phase2.ptau'));
await zKey.newZKey(scratch('multiplier.r1cs'), scratch('phase2.ptau'), scratch('initial.zkey'));
await zKey.contribute(scratch('initial.zkey'), scratch('proving_key.zkey'), 'Local demo circuit contribution', entropy());
snarkjsCli('zkey', 'verify', scratch('multiplier.r1cs'), scratch('phase2.ptau'), scratch('proving_key.zkey'));

const vk = await zKey.exportVerificationKey(scratch('proving_key.zkey'));
await writeFile(join(output, rustKeyPath), renderRustKey(encodeVerificationKey(vk)));
await writeJson(published('verification_key.json'), vk);
const proofs = new Map();
for (const [fixture, witness] of Object.entries(witnesses)) {
  const { proof } = await groth16.fullProve(witness, scratch('multiplier_js/multiplier.wasm'), scratch('proving_key.zkey'));
  proofs.set(fixture, proof);
  await writeJson(published(`${fixture}.input.json`), witness);
  await writeJson(published(`${fixture}.proof.json`), proof);
  await writeJson(published(`${fixture}.encoded.json`), encodeProof(proof));
}
for (const testCase of cases) {
  if (await groth16.verify(vk, [testCase.publicInput], proofs.get(testCase.fixture)) !== testCase.expected) {
    throw new Error(`Generated proof failed: ${testCase.label}`);
  }
}

for (const name of ['multiplier.r1cs', 'proving_key.zkey', 'phase2.ptau']) {
  await copyFile(scratch(name), published(name));
}
await copyFile(scratch('multiplier_js/multiplier.wasm'), published('witness.wasm'));
console.log(`Fixtures: ${output}`);
// snarkjs keeps worker threads alive after the final operation.
process.exit(0);
