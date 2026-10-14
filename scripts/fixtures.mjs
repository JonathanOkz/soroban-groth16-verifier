import assert from 'node:assert/strict';
import { join } from 'node:path';
import { encodeProof } from './encoding.mjs';
import { projectRoot as root, readJson } from './io.mjs';

export const witnesses = {
  valid: { a: '3', b: '11', c: '33' },
  second: { a: '5', b: '7', c: '35' },
};

export const cases = [
  { label: 'valid', fixture: 'valid', publicInput: witnesses.valid.c, expected: true },
  { label: 'invalid', fixture: 'valid', publicInput: '34', expected: false },
  { label: 'second', fixture: 'second', publicInput: witnesses.second.c, expected: true },
];

export async function loadFixtures() {
  const json = path => readJson(join(root, path));
  const proofs = new Map();
  for (const fixture of Object.keys(witnesses)) {
    const { a, b, c } = encodeProof(await json(`fixtures/${fixture}.proof.json`));
    assert.deepEqual(await json(`fixtures/${fixture}.encoded.json`), { a, b, c },
      `Published encoding differs from snarkjs proof: ${fixture}`);
    proofs.set(fixture, { a: Buffer.from(a, 'hex'), b: Buffer.from(b, 'hex'), c: Buffer.from(c, 'hex') });
  }
  return proofs;
}
