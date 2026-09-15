const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

/** Deploys CertificateRegistry and writes its address + ABI to
 *  deployments/<network>.json, which the Sprint 4 backend reads to
 *  know where to send issueCertificate() / verifyCertificate() calls. */
async function main() {
  const network = hre.network.name;
  const [deployer] = await hre.ethers.getSigners();

  console.log(`[deploy] Deploying CertificateRegistry to "${network}" as ${deployer.address}`);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log(`[deploy] Deployer balance: ${hre.ethers.formatEther(balance)} ETH`);
  if (balance === 0n && network !== "hardhat") {
    console.warn("[deploy] WARNING: deployer wallet has zero balance — fund it from a Sepolia faucet first.");
  }

  const CertificateRegistry = await hre.ethers.getContractFactory("CertificateRegistry");
  const contract = await CertificateRegistry.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log(`[deploy] CertificateRegistry deployed at: ${address}`);

  const artifact = await hre.artifacts.readArtifact("CertificateRegistry");
  const deploymentInfo = {
    network,
    address,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
    abi: artifact.abi,
  };

  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) fs.mkdirSync(deploymentsDir, { recursive: true });
  const outPath = path.join(deploymentsDir, `${network}.json`);
  fs.writeFileSync(outPath, JSON.stringify(deploymentInfo, null, 2));
  console.log(`[deploy] Wrote deployment info to ${outPath}`);

  console.log("\n[deploy] Next steps:");
  console.log(`  1. Add these to backend/.env:`);
  console.log(`       CONTRACT_ADDRESS=${address}`);
  console.log(`       SEPOLIA_RPC_URL=<same RPC URL used here>`);
  console.log(`       ADMIN_WALLET_PRIVATE_KEY=<same deployer key used here>`);
  console.log(`  2. Copy deployments/${network}.json's "abi" field into backend/src/utils/CertificateRegistry.abi.json`);
  console.log(`  3. Run 'npm run verify:sepolia' to verify the source on Etherscan (optional).`);
}

main().catch((err) => {
  console.error("[deploy] Failed:", err);
  process.exitCode = 1;
});
