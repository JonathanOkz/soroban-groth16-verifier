// SPDX-License-Identifier: Apache-2.0

#![no_std]

use soroban_sdk::{
    BytesN, Env, U256, Vec, contract, contracterror, contractimpl,
    crypto::bn254::{Bn254Fr, Bn254G1Affine, Bn254G2Affine},
    vec,
};

mod verification_key;

// BN254 scalar modulus, big-endian.
const SCALAR_MODULUS: [u8; 32] = [
    0x30, 0x64, 0x4e, 0x72, 0xe1, 0x31, 0xa0, 0x29, 0xb8, 0x50, 0x45, 0xb6, 0x81, 0x81, 0x58, 0x5d,
    0x28, 0x33, 0xe8, 0x48, 0x79, 0xb9, 0x70, 0x91, 0x43, 0xe1, 0xf5, 0x93, 0xf0, 0x00, 0x00, 0x01,
];

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum VerifyError {
    WrongInputCount = 1,
    NonCanonicalScalar = 2,
    InfinityPoint = 3,
}

#[contract]
pub struct ProofVerifier;

#[contractimpl]
impl ProofVerifier {
    /// Verify a proof of a*b=c using the single verification key compiled here.
    // Raw bytes: Bn254Fr would reduce modulo r.
    pub fn verify(
        env: Env,
        a: BytesN<64>,
        b: BytesN<128>,
        c: BytesN<64>,
        public_inputs: Vec<BytesN<32>>,
    ) -> Result<bool, VerifyError> {
        if public_inputs.len() != 1 {
            return Err(VerifyError::WrongInputCount);
        }
        let scalar = public_inputs.get(0).unwrap();
        if scalar.to_array() >= SCALAR_MODULUS {
            return Err(VerifyError::NonCanonicalScalar);
        }
        if a.to_array() == [0; 64] || b.to_array() == [0; 128] || c.to_array() == [0; 64] {
            return Err(VerifyError::InfinityPoint);
        }
        let bn = env.crypto().bn254();
        let input = Bn254Fr::from_u256(U256::from_be_bytes(&env, &scalar.into()));
        let ic0 = Bn254G1Affine::from_array(&env, &verification_key::IC0);
        let ic1 = Bn254G1Affine::from_array(&env, &verification_key::IC1);
        let vk_x = bn.g1_add(&ic0, &bn.g1_mul(&ic1, &input));
        // Groth16: e(-A,B) e(alpha,beta) e(IC0+c*IC1,gamma) e(C,delta) = 1.
        let lhs = vec![
            &env,
            -Bn254G1Affine::from_bytes(a),
            Bn254G1Affine::from_array(&env, &verification_key::ALPHA),
            vk_x,
            Bn254G1Affine::from_bytes(c),
        ];
        let rhs = vec![
            &env,
            Bn254G2Affine::from_bytes(b),
            Bn254G2Affine::from_array(&env, &verification_key::BETA),
            Bn254G2Affine::from_array(&env, &verification_key::GAMMA),
            Bn254G2Affine::from_array(&env, &verification_key::DELTA),
        ];
        Ok(bn.pairing_check(lhs, rhs))
    }
}

#[cfg(test)]
mod tests;
