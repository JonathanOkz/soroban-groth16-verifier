import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, mkdtemp } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, basename } from 'node:path';
import { Keypair, Networks, TransactionBuilder, Operation, Address, BASE_FEE, rpc } from '@stellar/stellar-sdk';
import { projectRoot as root, sha256Hex, writeJson, builtWasmPath } from './io.mjs';
import { cases, loadFixtures } from './fixtures.mjs';
import { submitTransaction, verifyOperation } from './transactions.mjs';

const endpoint = 'https://soroban-testnet.stellar.org';
const server = new rpc.Server(endpoint);
const wasm = await readFile(builtWasmPath());
const wasmSha256 = sha256Hex(wasm);
const proofs = await loadFixtures();
const network = await server.getNetwork();
const protocolVersion = Number(network.protocolVersion);
if (network.passphrase !== Networks.TESTNET) {
  throw new Error('Expected Stellar testnet');
}

const privateDir = await mkdtemp(join(tmpdir(), 'soroban-demo-private-'));
const signer = Keypair.random();
const secretPath = join(privateDir, 'testnet-signer.secret');
await writeFile(secretPath, signer.secret());
console.log(`Account key file: ${secretPath}`);

await mkdir(join(root, 'testnet-runs'), { recursive: true });
const output = await mkdtemp(join(root, 'testnet-runs', `${new Date().toISOString().replace(/[:.]/g, '-')}-`));
await server.fundAddress(signer.publicKey(), 'https://friendbot.stellar.org');
const account = await server.getAccount(signer.publicKey());
const transactions = [];

async function send(label, operation) {
  const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: Networks.TESTNET })
    .addOperation(operation).setTimeout(60).build();
  const { value, record } = await submitTransaction(server, tx, signer);
  const row = { label, ...record };
  transactions.push(row);
  console.log(`${label}: ${record.feeXlm} XLM`);
  return { value, row };
}

const uploaded = await send('upload', Operation.uploadContractWasm({ wasm }));
const wasmHash = Buffer.from(uploaded.value);
assert.equal(wasmHash.toString('hex'), wasmSha256, 'Installed WASM hash mismatch');
const { value: contractId } = await send('deploy', Operation.createCustomContract({
  address: new Address(signer.publicKey()), wasmHash, salt: randomBytes(32),
}));
for (const testCase of cases) {
  const { value, row } = await send(testCase.label, verifyOperation(contractId, proofs.get(testCase.fixture), testCase.publicInput));
  assert.equal(value, testCase.expected, `${testCase.label}: unexpected verifier result`);
  Object.assign(row, { publicInput: testCase.publicInput, verifierResult: value });
}
await writeJson(join(output, 'report.json'), {
  network: 'testnet', protocolVersion, rpcEndpoint: endpoint,
  contractId, signerPublicKey: signer.publicKey(), wasmSha256,
  completedAt: new Date().toISOString(),
  transactions,
});
console.log(`Contract: ${contractId}`);
console.log(`Report: testnet-runs/${basename(output)}/report.json`);
