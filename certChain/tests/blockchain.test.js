const test = require("node:test");
const assert = require("node:assert/strict");
const { issueCertificateOnChain, verifyCertificateOnChain } = require("../src/utils/blockchain");

test("issueCertificateOnChain returns a well-formed simulated transaction", async () => {
  const result = await issueCertificateOnChain("somehash", "cert-1");
  assert.match(result.txHash, /^0x[0-9a-f]{64}$/);
  assert.equal(typeof result.blockNumber, "number");
  assert.equal(result.simulated, true);
});

test("issueCertificateOnChain increments the block number on each call", async () => {
  const first = await issueCertificateOnChain("hashA", "cert-a");
  const second = await issueCertificateOnChain("hashB", "cert-b");
  assert.ok(second.blockNumber > first.blockNumber);
});

test("verifyCertificateOnChain resolves without throwing (Sprint 5 will make this a real chain call)", async () => {
  const result = await verifyCertificateOnChain("somehash");
  assert.equal(result.simulated, true);
});
