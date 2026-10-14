// BN254 uses different moduli for point coordinates (Fq) and public scalars (Fr).
const FQ = 21888242871839275222246405745257275088696311157297823662689037894645226208583n;
export const FR = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;

export function fieldBytes(value, modulus) {
  const n = BigInt(value);
  if (n < 0n || n >= modulus) throw new Error('Field element out of range');
  return Buffer.from(n.toString(16).padStart(64, '0'), 'hex');
}

function encodeG1(point) {
  if (!Array.isArray(point) || point.length !== 3 || point[2] !== '1') {
    throw new Error('Expected an affine snarkjs G1 point');
  }
  return Buffer.concat([fieldBytes(point[0], FQ), fieldBytes(point[1], FQ)]);
}

function encodeG2(point) {
  if (!Array.isArray(point) || point.length !== 3 ||
      point.some(part => !Array.isArray(part) || part.length !== 2) ||
      point[2][0] !== '1' || point[2][1] !== '0') {
    throw new Error('Expected an affine snarkjs G2 point');
  }
  // snarkjs: real, imaginary. Host: imaginary, real, for each coordinate.
  return Buffer.concat([point[0][1], point[0][0], point[1][1], point[1][0]]
    .map(value => fieldBytes(value, FQ)));
}

export function encodeProof(proof) {
  if (proof?.protocol !== 'groth16' || proof.curve !== 'bn128') {
    throw new Error('Expected Groth16 over BN254 (snarkjs bn128)');
  }
  return {
    a: encodeG1(proof.pi_a).toString('hex'),
    b: encodeG2(proof.pi_b).toString('hex'),
    c: encodeG1(proof.pi_c).toString('hex'),
  };
}

export function encodeVerificationKey(vk) {
  if (vk?.protocol !== 'groth16' || vk.curve !== 'bn128' || vk.nPublic !== 1 ||
      !Array.isArray(vk.IC) || vk.IC.length !== 2) {
    throw new Error('Expected a single-public-input Groth16 verification key over BN254');
  }
  return {
    ALPHA: encodeG1(vk.vk_alpha_1), BETA: encodeG2(vk.vk_beta_2),
    GAMMA: encodeG2(vk.vk_gamma_2), DELTA: encodeG2(vk.vk_delta_2),
    IC0: encodeG1(vk.IC[0]), IC1: encodeG1(vk.IC[1]),
  };
}
