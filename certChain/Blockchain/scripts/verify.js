const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

/** Verifies the deployed contract's source on Etherscan, so anyone can
 *  read CertificateRegistry.sol directly against the deployed bytecode
 *  without trusting this repository. Optional but recommended — see
 *  the recommendation in Section 5.7 about auditing before production. */
async function main() {
  const network = hre.network.name;
  const deploymentPath = path.join(__dirname, "..", "deployments", `${network}.json`);

  if (!fs.existsSync(deploymentPath)) {
    throw new Error(`No deployment found for "${network}". Run 'npm run deploy:sepolia' first.`);
  }

  const { address } = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  console.log(`[verify] Verifying CertificateRegistry at ${address} on ${network}...`);

  await hre.run("verify:verify", {
    address,
    constructorArguments: [], // constructor takes no arguments
  });

  console.log("[verify] Done. Check the contract page on Etherscan.");
}

main().catch((err) => {
  console.error("[verify] Failed:", err.message);
  process.exitCode = 1;
});
