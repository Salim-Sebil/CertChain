// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title CertificateRegistry
/// @notice On-chain registry of academic certificate hashes for the
///         Blockchain-Based Certificate Verification System.
/// @dev    Implements the design in Section 4.3.5 (Smart Contract Design).
///         Expanded from the two-function pseudocode there with:
///           - a multi-admin model (addAdmin/removeAdmin), since in
///             practice more than one registrar staff member needs to
///             issue certificates, not just a single deployer wallet;
///           - explicit revocation state (revoked / revokedAt) rather
///             than only an `exists` flag, so a revoked certificate's
///             history is distinguishable from one that was never
///             issued, per the audit-trail requirement in Section 4.3.5;
///           - a totalIssued counter and richer events, useful for the
///             reporting feature in Section 4.4.3 / FR-A8.
contract CertificateRegistry {
    struct CertificateRecord {
        string certId;      // off-chain certificate identifier (Mongo _id)
        uint256 timestamp;  // block timestamp at issuance
        bool exists;        // true once issued, never unset
        bool revoked;       // true if later revoked
        uint256 revokedAt;  // block timestamp at revocation, 0 if not revoked
    }

    address public owner;
    mapping(address => bool) public admins;
    mapping(bytes32 => CertificateRecord) private certificates;
    uint256 public totalIssued;

    event AdminAdded(address indexed account);
    event AdminRemoved(address indexed account);
    event CertificateIssued(bytes32 indexed certHash, string certId, uint256 timestamp);
    event CertificateRevoked(bytes32 indexed certHash, uint256 timestamp);

    modifier onlyOwner() {
        require(msg.sender == owner, "CertificateRegistry: caller is not the owner");
        _;
    }

    modifier onlyAdmin() {
        require(admins[msg.sender], "CertificateRegistry: caller is not an admin");
        _;
    }

    constructor() {
        owner = msg.sender;
        admins[msg.sender] = true;
        emit AdminAdded(msg.sender);
    }

    /// @notice Authorises another wallet (e.g. a registrar's staff
    ///         account) to issue and revoke certificates.
    function addAdmin(address account) external onlyOwner {
        require(account != address(0), "CertificateRegistry: zero address");
        admins[account] = true;
        emit AdminAdded(account);
    }

    /// @notice Revokes an admin's authorisation. The contract owner can
    ///         never be removed this way, to avoid accidentally locking
    ///         the institution out of its own registry.
    function removeAdmin(address account) external onlyOwner {
        require(account != owner, "CertificateRegistry: cannot remove owner");
        admins[account] = false;
        emit AdminRemoved(account);
    }

    /// @notice Registers a certificate's hash on-chain. Reverts if the
    ///         hash has already been registered, matching the
    ///         duplicate-prevention requirement (FR-C2) and the
    ///         certificateExists() check in Section 4.3.5.
    /// @param certHash SHA-256 hash of the certificate content, computed
    ///        off-chain by the application layer (Section 4.4.6).
    /// @param certId Off-chain identifier for the certificate, so the
    ///        application layer can look up the full record after
    ///        reading it back from an event or verifyCertificate().
    function issueCertificate(bytes32 certHash, string calldata certId) external onlyAdmin {
        require(certHash != bytes32(0), "CertificateRegistry: empty hash");
        require(bytes(certId).length > 0, "CertificateRegistry: certId required");
        require(!certificates[certHash].exists, "CertificateRegistry: certificate already registered");

        certificates[certHash] = CertificateRecord({
            certId: certId,
            timestamp: block.timestamp,
            exists: true,
            revoked: false,
            revokedAt: 0
        });
        totalIssued += 1;

        emit CertificateIssued(certHash, certId, block.timestamp);
    }

    /// @notice Checks a certificate hash against the on-chain record.
    ///         Publicly callable with no restriction, so any verifier
    ///         can independently confirm authenticity (Section 4.3.5).
    function verifyCertificate(bytes32 certHash)
        external
        view
        returns (bool exists, string memory certId, uint256 timestamp, bool revoked)
    {
        CertificateRecord storage record = certificates[certHash];
        return (record.exists, record.certId, record.timestamp, record.revoked);
    }

    /// @notice Lightweight existence check, used internally by
    ///         issueCertificate() and exposed publicly for convenience.
    function certificateExists(bytes32 certHash) public view returns (bool) {
        return certificates[certHash].exists;
    }

    /// @notice Flags a certificate as revoked without deleting its
    ///         record, preserving the historical audit trail described
    ///         in Section 4.3.5 (FR-A7).
    function revokeCertificate(bytes32 certHash) external onlyAdmin {
        require(certificates[certHash].exists, "CertificateRegistry: certificate not found");
        require(!certificates[certHash].revoked, "CertificateRegistry: already revoked");

        certificates[certHash].revoked = true;
        certificates[certHash].revokedAt = block.timestamp;

        emit CertificateRevoked(certHash, block.timestamp);
    }
}
