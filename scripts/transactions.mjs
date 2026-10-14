import { Contract, scValToNative, xdr } from '@stellar/stellar-sdk';
import { fieldBytes, FR } from './encoding.mjs';

export function verifyOperation(contractId, proof, publicInput) {
  return new Contract(contractId).call('verify',
    ...[proof.a, proof.b, proof.c].map(bytes => xdr.ScVal.scvBytes(bytes)),
    xdr.ScVal.scvVec([xdr.ScVal.scvBytes(fieldBytes(publicInput, FR))]));
}

export async function submitTransaction(server, transaction, signer) {
  const tx = await server.prepareTransaction(transaction);
  tx.sign(signer);
  const { hash, status } = await server.sendTransaction(tx);
  console.log(`Transaction: ${hash}`);
  if (!['PENDING', 'DUPLICATE'].includes(status)) {
    throw new Error(`Transaction ${hash}: ${status}`);
  }
  const confirmed = await server.pollTransaction(hash, { attempts: 60, sleepStrategy: () => 2000 });
  if (confirmed.status !== 'SUCCESS') throw new Error(`Transaction ${hash}: ${confirmed.status}`);
  if (!confirmed.returnValue) throw new Error('Missing contract return value');
  const fee = confirmed.resultXdr.feeCharged;
  return {
    value: scValToNative(confirmed.returnValue),
    record: {
      transactionHash: hash,
      ledger: confirmed.ledger,
      feeChargedStroops: fee.toString(),
      feeXlm: `${fee / 10_000_000n}.${(fee % 10_000_000n).toString().padStart(7, '0')}`,
    },
  };
}
