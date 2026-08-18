/** ================================================================
 *  Blockchain layer — Section 4.4.4.
 *
 *  Sprint 4 (this file) implements the Node.js/Express/MongoDB layers
 *  only. Sprint 5 (Blockchain Integration) deploys the CertificateRegistry
 *  contract from Section 4.3.5 to the Ethereum Sepolia testnet with
 *  Hardhat, and replaces the body of every function below with a real
 *  ethers.js call against that deployed contract — the function
 *  signatures and return shapes are written now so nothing above this
 *  layer (controllers, routes) has to change when that happens.
 *
 *  Until then, every certificate issuance still gets a genuine SHA-256
 *  hash (src/utils/hash.js) and a realistic-looking transaction record;
 *  only the on-chain registration itself is simulated. `simulated: true`
 *  on the stored BlockchainTransaction document makes this visible in
 *  the data, so nobody mistakes demo data for a real chain record.
 *  ================================================================ */

let blockCounter = 5_812_040 + Math.floor(Math.random() * 500);

function randomTxHash() {
  const bytes = [...Array(32)].map(() => Math.floor(Math.random() * 256));
  return "0x" + bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Real implementation (Sprint 5):
 *    const contract = getContract(); // ethers.Contract, signer = admin wallet
 *    const tx = await contract.issueCertificate(hash, certificateId);
 *    const receipt = await tx.wait();
 *    return { txHash: receipt.hash, blockNumber: receipt.blockNumber, contractAddress: contract.target, simulated: false };
 */
async function issueCertificateOnChain(hash, certificateId) {
  void hash;
  void certificateId;
  return {
    txHash: randomTxHash(),
    blockNumber: blockCounter++,
    contractAddress: process.env.CONTRACT_ADDRESS || "0xSIMULATED0000000000000000000000000000",
    simulated: true,
  };
}

/** Real implementation (Sprint 5):
 *    const contract = getContract();
 *    const [exists, certId, timestamp] = await contract.verifyCertificate(hash);
 *    return { onChain: exists, certificateId: certId, timestamp };
 *
 *  Sprint 4 has no chain to ask, so the source of truth is MongoDB —
 *  the controller that calls this already has the certificate document
 *  and doesn't need this function to look anything up. It exists so the
 *  call site is ready for Sprint 5 without further refactoring. */
async function verifyCertificateOnChain(hash) {
  void hash;
  return { onChain: true, simulated: true };
}

/** Real implementation (Sprint 5): await contract.revokeCertificate(hash) */
async function revokeCertificateOnChain(hash) {
  void hash;
  return { simulated: true };
}

module.exports = { issueCertificateOnChain, verifyCertificateOnChain, revokeCertificateOnChain };
