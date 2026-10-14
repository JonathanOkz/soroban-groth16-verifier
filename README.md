# soroban-groth16-verifier

This demo generates a Groth16 proof with Circom and verifies it in a Soroban contract on Stellar testnet. The circuit checks `a * b = c` over the scalar field, with `c` as the public input. Soroban verifies the proof using native BN254 operations.

A failed pairing check returns `false`. Invalid input lengths, scalars or curve points raise a contract or Soroban host error.

The included parameters come from a single-party demo setup and the witnesses are public. They are not suitable for production.

## Testnet results

Tested on testnet on 14 October 2026. Source code verified on StellarExpert.

Contract: [`CD4TNAQANCELKRSQ4XD2KFEAZN7CF6T7GDDJYZYWIIKFIY5D2HUKG7AI`](https://stellar.expert/explorer/testnet/contract/CD4TNAQANCELKRSQ4XD2KFEAZN7CF6T7GDDJYZYWIIKFIY5D2HUKG7AI)

| Test | Public input | Result | Transaction |
| --- | --- | --- | --- |
| Proof for `3 * 11` | 33 | `true` | [5b9d9c81](https://stellar.expert/explorer/testnet/tx/5b9d9c814bc4294e8e6d1d2e87dc37d68ae5d80b8e31d7218cd6ddc55d3deaa7) |
| Same proof, wrong input | 34 | `false` | [5577e84c](https://stellar.expert/explorer/testnet/tx/5577e84c8ef5f3f9123fbc530552526e8d803045d3db1806a49ae3b4dd5a3e66) |
| Proof for `5 * 7` | 35 | `true` | [469836e1](https://stellar.expert/explorer/testnet/tx/469836e12abbdfc41e9f24019e02f924dcec8666c68241466b69084695be72a5) |

Verification cost: **0.0023203 XLM** per call in this run, excluding deployment. [Report](testnet-runs/2026-10-14T14-21-45-671Z-qbJtOD/report.json).

## Build and test

Requires Node.js 22.12+ and [Stellar CLI 28.1.0](https://github.com/stellar/stellar-cli/releases/tag/v28.1.0). Install [rustup](https://rustup.rs/) to use the pinned Rust toolchain. Proof fixtures are included.

```sh
npm ci --ignore-scripts
cargo test --locked
npm test
```

`cargo test` checks rejection of invalid inputs. `npm test` builds the WASM and checks that it accepts valid proofs and rejects a proof with the wrong public input.

## Deploy to testnet

```sh
npm run testnet
```

To deploy the verified [release](https://github.com/JonathanOkz/soroban-groth16-verifier/releases/tag/v0.1.0_proof-verifier_cli28.1.0), download its WASM with the GitHub CLI and pass it to the script:

```sh
release_dir=$(mktemp -d)
gh release download v0.1.0_proof-verifier_cli28.1.0 \
  --repo JonathanOkz/soroban-groth16-verifier \
  --pattern '*.wasm' --dir "$release_dir"
node scripts/testnet.mjs "$release_dir/proof-verifier_v0.1.0.wasm"
```

The script creates a Friendbot-funded account, deploys the contract and runs the three cases. It saves results directly in a new directory under `testnet-runs/` and writes `report.json` after all three cases pass.

## Generate a proof

Use the included parameters to create another proof for `3 * 11 = 33`:

```sh
proof_dir=$(mktemp -d)
npx --no-install snarkjs groth16 fullprove \
  fixtures/valid.input.json fixtures/witness.wasm fixtures/proving_key.zkey \
  "$proof_dir/proof.json" "$proof_dir/public.json"
npx --no-install snarkjs groth16 verify \
  fixtures/verification_key.json "$proof_dir/public.json" "$proof_dir/proof.json"
```

To regenerate the demo parameters, install Circom 2.2.3 and choose an output directory:

```sh
parameters_dir=$(mktemp -d)
npm run fixtures -- "$parameters_dir"
```

The command writes new fixtures and their Rust verification key to that directory, replacing existing generated files. To use them, replace both in the project and rebuild the contract.

## License

[Apache-2.0](LICENSE). Attribution in [NOTICE](NOTICE).
