const { expect } = require("chai");
const { ethers } = require("hardhat");

/** Covers the requirements this contract must satisfy per Section 4.3.5
 *  and the functional requirements FR-C1..FR-C4 (Sprint 1 SRS, Section 3.4). */
describe("CertificateRegistry", function () {
  let registry, owner, admin2, student, verifier;
  const sampleHash = ethers.keccak256(ethers.toUtf8Bytes("sample-certificate-content"));
  const otherHash = ethers.keccak256(ethers.toUtf8Bytes("a-different-certificate"));
  const certId = "cert-mongo-id-001";

  beforeEach(async function () {
    [owner, admin2, student, verifier] = await ethers.getSigners();
    const CertificateRegistry = await ethers.getContractFactory("CertificateRegistry");
    registry = await CertificateRegistry.deploy();
    await registry.waitForDeployment();
  });

  describe("Deployment", function () {
    it("sets the deployer as owner", async function () {
      expect(await registry.owner()).to.equal(owner.address);
    });

    it("sets the deployer as an admin", async function () {
      expect(await registry.admins(owner.address)).to.equal(true);
    });

    it("starts with totalIssued at zero", async function () {
      expect(await registry.totalIssued()).to.equal(0);
    });
  });

  describe("Admin management (owner-only)", function () {
    it("lets the owner add a new admin", async function () {
      await expect(registry.addAdmin(admin2.address))
        .to.emit(registry, "AdminAdded")
        .withArgs(admin2.address);
      expect(await registry.admins(admin2.address)).to.equal(true);
    });

    it("rejects addAdmin from a non-owner", async function () {
      await expect(registry.connect(admin2).addAdmin(verifier.address)).to.be.revertedWith(
        "CertificateRegistry: caller is not the owner"
      );
    });

    it("rejects adding the zero address as admin", async function () {
      await expect(registry.addAdmin(ethers.ZeroAddress)).to.be.revertedWith(
        "CertificateRegistry: zero address"
      );
    });

    it("lets the owner remove an admin", async function () {
      await registry.addAdmin(admin2.address);
      await expect(registry.removeAdmin(admin2.address))
        .to.emit(registry, "AdminRemoved")
        .withArgs(admin2.address);
      expect(await registry.admins(admin2.address)).to.equal(false);
    });

    it("never lets the owner be removed as admin", async function () {
      await expect(registry.removeAdmin(owner.address)).to.be.revertedWith(
        "CertificateRegistry: cannot remove owner"
      );
    });

    it("a newly-added admin can issue certificates", async function () {
      await registry.addAdmin(admin2.address);
      await expect(registry.connect(admin2).issueCertificate(sampleHash, certId)).to.not.be.reverted;
    });
  });

  describe("issueCertificate (FR-C1, FR-C2)", function () {
    it("registers a certificate hash and emits CertificateIssued", async function () {
      await expect(registry.issueCertificate(sampleHash, certId)).to.emit(registry, "CertificateIssued");
    });

    it("increments totalIssued", async function () {
      await registry.issueCertificate(sampleHash, certId);
      expect(await registry.totalIssued()).to.equal(1);
    });

    it("rejects issuance from a non-admin account", async function () {
      await expect(registry.connect(student).issueCertificate(sampleHash, certId)).to.be.revertedWith(
        "CertificateRegistry: caller is not an admin"
      );
    });

    it("rejects a duplicate hash (FR-C2)", async function () {
      await registry.issueCertificate(sampleHash, certId);
      await expect(registry.issueCertificate(sampleHash, "a-different-cert-id")).to.be.revertedWith(
        "CertificateRegistry: certificate already registered"
      );
    });

    it("rejects an empty (zero) hash", async function () {
      await expect(registry.issueCertificate(ethers.ZeroHash, certId)).to.be.revertedWith(
        "CertificateRegistry: empty hash"
      );
    });

    it("rejects an empty certId", async function () {
      await expect(registry.issueCertificate(sampleHash, "")).to.be.revertedWith(
        "CertificateRegistry: certId required"
      );
    });
  });

  describe("verifyCertificate (FR-C3)", function () {
    it("returns exists=false for a hash that was never issued", async function () {
      const [exists] = await registry.verifyCertificate(sampleHash);
      expect(exists).to.equal(false);
    });

    it("returns the correct record for an issued certificate", async function () {
      const tx = await registry.issueCertificate(sampleHash, certId);
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);

      const [exists, returnedCertId, timestamp, revoked] = await registry.verifyCertificate(sampleHash);
      expect(exists).to.equal(true);
      expect(returnedCertId).to.equal(certId);
      expect(timestamp).to.equal(block.timestamp);
      expect(revoked).to.equal(false);
    });

    it("is callable by any account, not just admins (public verification)", async function () {
      await registry.issueCertificate(sampleHash, certId);
      const [exists] = await registry.connect(verifier).verifyCertificate(sampleHash);
      expect(exists).to.equal(true);
    });

    it("distinguishes between two different certificates", async function () {
      await registry.issueCertificate(sampleHash, certId);
      const [existsOther] = await registry.verifyCertificate(otherHash);
      expect(existsOther).to.equal(false);
    });
  });

  describe("certificateExists", function () {
    it("mirrors the exists flag returned by verifyCertificate", async function () {
      expect(await registry.certificateExists(sampleHash)).to.equal(false);
      await registry.issueCertificate(sampleHash, certId);
      expect(await registry.certificateExists(sampleHash)).to.equal(true);
    });
  });

  describe("revokeCertificate (FR-C4)", function () {
    beforeEach(async function () {
      await registry.issueCertificate(sampleHash, certId);
    });

    it("marks a certificate as revoked and emits CertificateRevoked", async function () {
      await expect(registry.revokeCertificate(sampleHash)).to.emit(registry, "CertificateRevoked");
      const [exists, , , revoked] = await registry.verifyCertificate(sampleHash);
      expect(exists).to.equal(true); // history preserved, per Section 4.3.5
      expect(revoked).to.equal(true);
    });

    it("rejects revocation from a non-admin account", async function () {
      await expect(registry.connect(student).revokeCertificate(sampleHash)).to.be.revertedWith(
        "CertificateRegistry: caller is not an admin"
      );
    });

    it("rejects revoking a certificate that was never issued", async function () {
      await expect(registry.revokeCertificate(otherHash)).to.be.revertedWith(
        "CertificateRegistry: certificate not found"
      );
    });

    it("rejects revoking an already-revoked certificate", async function () {
      await registry.revokeCertificate(sampleHash);
      await expect(registry.revokeCertificate(sampleHash)).to.be.revertedWith(
        "CertificateRegistry: already revoked"
      );
    });

    it("keeps totalIssued unchanged after a revocation", async function () {
      await registry.revokeCertificate(sampleHash);
      expect(await registry.totalIssued()).to.equal(1);
    });
  });
});
