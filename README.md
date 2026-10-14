# soroban-groth16-verifier

This demo generates a Groth16 proof with Circom and verifies it in a Soroban contract on Stellar testnet. The circuit checks `a * b = c` over the scalar field, with `c` as the public input. Soroban verifies the proof using native BN254 operations.

A failed pairing check returns `false`. Invalid input lengths, scalars or curve points raise a contract or Soroban host error.

The included parameters come from a single-party demo setup and the witnesses are public. They are not suitable for production.

## Testnet results

Tested on testnet on 14 October 2026.

Contract: [`CDKXOFMYNT3JATHGJYXDPABDNCZXVCNNLJWSSOE7Q3TKK4I2JJT3FEEZ`](https://stellar.expert/explorer/testnet/contract/CDKXOFMYNT3JATHGJYXDPABDNCZXVCNNLJWSSOE7Q3TKK4I2JJT3FEEZ)

| Test | Public input | Result | Transaction |
| --- | --- | --- | --- |
| Proof for `3 * 11` | 33 | `true` | [0459fd86](https://stellar.expert/explorer/testnet/tx/0459fd86db0fd801131ef915eb9bccda669791fe41509827fabfd8f48c5b1549) |
| Same proof, wrong input | 34 | `false` | [0cc91d67](https://stellar.expert/explorer/testnet/tx/0cc91d6734c63ce038054f30978d33f40913dc255606d5cc512ad5072a4dc0b6) |
| Proof for `5 * 7` | 35 | `true` | [8814ce61](https://stellar.expert/explorer/testnet/tx/8814ce61fd2f3fafa8a4ce8b15bd901abc0e46b2df6253c97ef2119092198ada) |

Verification cost: **0.0023203 XLM** per call in this run, excluding deployment. [Report](testnet-runs/2026-10-14T14-06-10-387Z-m5SEDq/report.json).

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
