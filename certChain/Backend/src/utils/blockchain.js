const fs = require("fs");
const path = require("path");

/** ================================================================
 *  Blockchain layer — Section 4.4.4.
 *
 *  Sprint 5 deliverable: real ethers.js calls against the deployed
 *  CertificateRegistry contract (see ../../../blockchain/contracts/
 *  CertificateRegistry.sol) when SEPOLIA_RPC_URL, CONTRACT_ADDRESS and
 *  ADMIN_WALLET_PRIVATE_KEY are all set in .env.
 *
 *  If any of those are missing — e.g. no contract has been deployed
 *  yet, or you're running the API in a plain Sprint 4 dev setup — this
 *  file automatically falls back to the same clearly-labelled
 *  simulation Sprint 4 shipped with, rather than crashing the server.
 *  Every function keeps the exact same signature and return shape
 *  either way, so nothing in the controllers that call these functions
 *  needs to know or care which mode is active.
 *  ================================================================ */

let ethers = null;
try {
  // Optional dependency: only required if real chain calls are configured.
  // eslint-disable-next-line global-require
  ethers = require("ethers");
} catch {
  ethers = null;
}

const CHAIN_CONFIGURED = Boolean(
  ethers && process.env.SEPOLIA_RPC_URL && process.env.CONTRACT_ADDRESS && process.env.ADMIN_WALLET_PRIVATE_KEY
);

let cachedContract = null;

function loadAbi() {
  const abiPath = path.join(__dirname, "CertificateRegistry.abi.json");
  const parsed = JSON.parse(fs.readFileSync(abiPath, "utf8"));
  return parsed.abi || parsed; // supports both the wrapped and raw ABI array forms
}

function getContract() {
  if (cachedContract) return cachedContract;
  const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
  const wallet = new ethers.Wallet(process.env.ADMIN_WALLET_PRIVATE_KEY, provider);
  cachedContract = new ethers.Contract(process.env.CONTRACT_ADDRESS, loadAbi(), wallet);
  return cachedContract;
}

/* ---------------- Simulation fallback (unchanged from Sprint 4) ---------------- */

let blockCounter = 5_812_040 + Math.floor(Math.random() * 500);

function randomTxHash() {
  const bytes = [...Array(32)].map(() => Math.floor(Math.random() * 256));
  return "0x" + bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function simulateIssue() {
  return {
    txHash: randomTxHash(),
    blockNumber: blockCounter++,
    contractAddress: process.env.CONTRACT_ADDRESS || "0xSIMULATED0000000000000000000000000000",
    simulated: true,
  };
}

/* ---------------- Public interface ---------------- */

/** Registers a certificate hash on-chain. Section 4.3.3, step 3-4. */
async function issueCertificateOnChain(hash, certificateId) {
  if (!CHAIN_CONFIGURED) return simulateIssue();

  try {
    const contract = getContract();
    const tx = await contract.issueCertificate(hash, certificateId);
    const receipt = await tx.wait();
    return {
      txHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      contractAddress: await contract.getAddress(),
      simulated: false,
    };
  } catch (err) {
    // A misconfigured RPC URL, an unfunded wallet, or a reverted tx
    // (e.g. duplicate hash) should surface as a normal operational
    // error to the caller, not crash the process.
    err.isOperational = true;
    err.statusCode = err.statusCode || 502;
    if (!err.message?.startsWith("CertificateRegistry:")) {
      err.message = `Blockchain transaction failed: ${err.reason || err.message}`;
    } else {
      err.message = err.message.replace(/^.*CertificateRegistry:/, "CertificateRegistry:");
    }
    throw err;
  }
}

/** Cross-checks a hash against the on-chain record. Not called by the
 *  current certificate controller (MongoDB is queried directly there,
 *  since it already has the document in hand) — this exists for cases
 *  where a caller only has a hash and no database record to start
 *  from, e.g. an independent, off-platform audit script. */
async function verifyCertificateOnChain(hash) {
  if (!CHAIN_CONFIGURED) return { onChain: true, simulated: true };

  const contract = getContract();
  const [exists, certId, timestamp, revoked] = await contract.verifyCertificate(hash);
  return { onChain: exists, certificateId: certId, timestamp: Number(timestamp), revoked, simulated: false };
}

/** Flags a certificate as revoked on-chain. Section 4.3.5, revokeCertificate(). */
async function revokeCertificateOnChain(hash) {
  if (!CHAIN_CONFIGURED) return { simulated: true };

  try {
    const contract = getContract();
    const tx = await contract.revokeCertificate(hash);
    const receipt = await tx.wait();
    return { txHash: receipt.hash, blockNumber: receipt.blockNumber, simulated: false };
  } catch (err) {
    err.isOperational = true;
    err.statusCode = err.statusCode || 502;
    if (!err.message?.startsWith("CertificateRegistry:")) {
      err.message = `Blockchain transaction failed: ${err.reason || err.message}`;
    } else {
      err.message = err.message.replace(/^.*CertificateRegistry:/, "CertificateRegistry:");
    }
    throw err;
  }
}

module.exports = {
  issueCertificateOnChain,
  verifyCertificateOnChain,
  revokeCertificateOnChain,
  CHAIN_CONFIGURED,
};
