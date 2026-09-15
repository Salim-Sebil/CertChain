const mongoose = require("mongoose");

/** Table 4.1 — BlockchainTransactions collection. Populated by
 *  src/utils/blockchain.js — real once Sprint 5 deploys the
 *  CertificateRegistry contract to Sepolia, simulated until then. */
const blockchainTransactionSchema = new mongoose.Schema(
  {
    certificate: { type: mongoose.Schema.Types.ObjectId, ref: "Certificate", required: true, unique: true },
    txHash: { type: String, required: true },
    blockNumber: { type: Number, required: true },
    contractAddress: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    simulated: { type: Boolean, default: true }, // false once Sprint 5 wires the real chain
  },
  { timestamps: false }
);

module.exports = mongoose.model("BlockchainTransaction", blockchainTransactionSchema);
