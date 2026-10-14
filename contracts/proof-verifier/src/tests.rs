extern crate std;

use super::*;
use serde_json::Value;
use soroban_sdk::InvokeError;

fn hex<const N: usize>(s: &str) -> [u8; N] {
    assert_eq!(s.len(), N * 2);
    let mut out = [0; N];
    for (i, byte) in out.iter_mut().enumerate() {
        *byte = u8::from_str_radix(&s[i * 2..i * 2 + 2], 16).unwrap();
    }
    out
}

const VALID_PROOF: &str = include_str!("../../../fixtures/valid.encoded.json");
const SECOND_PROOF: &str = include_str!("../../../fixtures/second.encoded.json");

type Proof = (BytesN<64>, BytesN<128>, BytesN<64>);

fn proof(env: &Env, encoded: &str) -> Proof {
    let p: Value = serde_json::from_str(encoded).unwrap();
    (
        BytesN::from_array(env, &hex(p["a"].as_str().unwrap())),
        BytesN::from_array(env, &hex(p["b"].as_str().unwrap())),
        BytesN::from_array(env, &hex(p["c"].as_str().unwrap())),
    )
}

fn scalar(env: &Env, bytes: [u8; 32]) -> Vec<BytesN<32>> {
    vec![env, BytesN::from_array(env, &bytes)]
}

fn inputs(env: &Env, value: u32) -> Vec<BytesN<32>> {
    let mut bytes = [0; 32];
    bytes[28..].copy_from_slice(&value.to_be_bytes());
    scalar(env, bytes)
}

fn setup() -> (Env, ProofVerifierClient<'static>, Proof) {
    let env = Env::default();
    let client = ProofVerifierClient::new(&env, &env.register(ProofVerifier, ()));
    let proof = proof(&env, VALID_PROOF);
    (env, client, proof)
}

#[test]
#[ignore = "Run npm test to build and test the WASM"]
fn compiled_wasm_binds_the_public_input() {
    let wasm = std::fs::read(std::env::var("DEMO_WASM").expect("Run npm test"))
        .expect("Read compiled WASM");
    let env = Env::default();
    let client = ProofVerifierClient::new(&env, &env.register(wasm.as_slice(), ()));
    let (a, b, c) = proof(&env, VALID_PROOF);
    assert!(client.verify(&a, &b, &c, &inputs(&env, 33)));
    assert!(!client.verify(&a, &b, &c, &inputs(&env, 34)));
    let (a, b, c) = proof(&env, SECOND_PROOF);
    assert!(client.verify(&a, &b, &c, &inputs(&env, 35)));
}

#[test]
fn rejects_wrong_input_count_and_noncanonical_scalars() {
    let (env, client, (a, b, c)) = setup();
    let mut two = inputs(&env, 33);
    two.push_back(BytesN::from_array(&env, &[0; 32]));
    for (label, bad) in [("none", Vec::new(&env)), ("two", two)] {
        assert_eq!(
            client.try_verify(&a, &b, &c, &bad),
            Err(Ok(VerifyError::WrongInputCount)),
            "{label}"
        );
    }
    // BN254 scalar modulus.
    let fr = hex::<32>("30644e72e131a029b85045b68181585d2833e84879b9709143e1f593f0000001");
    let alias = hex::<32>("30644e72e131a029b85045b68181585d2833e84879b9709143e1f593f0000022");
    for value in [fr, alias] {
        assert_eq!(
            client.try_verify(&a, &b, &c, &scalar(&env, value)),
            Err(Ok(VerifyError::NonCanonicalScalar))
        );
    }
}

#[test]
fn rejects_infinity_and_invalid_curve_points() {
    let (env, client, (a, b, c)) = setup();
    let input = inputs(&env, 33);
    let zero64 = BytesN::from_array(&env, &[0; 64]);
    let zero128 = BytesN::from_array(&env, &[0; 128]);
    for (label, a2, b2, c2) in [
        ("a", &zero64, &b, &c),
        ("b", &a, &zero128, &c),
        ("c", &a, &b, &zero64),
    ] {
        assert_eq!(
            client.try_verify(a2, b2, c2, &input),
            Err(Ok(VerifyError::InfinityPoint)),
            "all-zero {label}"
        );
    }
    let off_curve = BytesN::from_array(&env, &[1; 64]);
    assert_eq!(
        client.try_verify(&off_curve, &b, &c, &input),
        Err(Err(InvokeError::Abort))
    );
}
