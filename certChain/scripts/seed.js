/** Seeds demo data matching the Sprint 3 frontend's mock accounts, so
 *  the two builds are interchangeable for a live demo. Run with:
 *    npm run seed
 *  Safe to re-run — it clears the relevant collections first. */
require("dotenv").config();
const connectDB = require("../src/config/db");
const User = require("../src/models/User");
const Student = require("../src/models/Student");
const Certificate = require("../src/models/Certificate");
const BlockchainTransaction = require("../src/models/BlockchainTransaction");
const VerificationLog = require("../src/models/VerificationLog");
const { generateCertificateHash } = require("../src/utils/hash");
const { issueCertificateOnChain } = require("../src/utils/blockchain");
const { generateQrDataUrl } = require("../src/utils/qr");

async function seed() {
  await connectDB();

  await Promise.all([
    User.deleteMany({}),
    Student.deleteMany({}),
    Certificate.deleteMany({}),
    BlockchainTransaction.deleteMany({}),
    VerificationLog.deleteMany({}),
  ]);

  const admin = await User.create({
    name: "Grace Odhiambo",
    email: "admin@svu.edu",
    password: "admin123",
    role: "admin",
  });

  const studentSeeds = [
    {
      name: "Amina Yusuf",
      email: "amina.yusuf@svu.edu",
      studentNumber: "SVU/2021/0142",
      programme: "BSc. Computer Science",
      department: "School of Computing",
      graduationYear: 2025,
      degree: "Bachelor of Science in Computer Science",
    },
    {
      name: "Brian Otieno",
      email: "brian.otieno@svu.edu",
      studentNumber: "SVU/2021/0198",
      programme: "BSc. Information Technology",
      department: "School of Computing",
      graduationYear: 2025,
      degree: "Bachelor of Science in Information Technology",
    },
  ];

  for (const s of studentSeeds) {
    const user = await User.create({ name: s.name, email: s.email, password: "student123", role: "student" });
    const student = await Student.create({
      user: user._id,
      studentNumber: s.studentNumber,
      programme: s.programme,
      department: s.department,
      graduationYear: s.graduationYear,
    });
    user.student = student._id;
    await user.save();

    const issueDate = new Date("2025-11-14");
    const certificateNumber = `SVU-2025-${Math.floor(1000 + Math.random() * 9000)}`;
    const certificate = new Certificate({
      student: student._id,
      certificateNumber,
      degree: s.degree,
      issueDate,
      hash: "pending",
      qrCode: "pending",
    });
    certificate.hash = generateCertificateHash({
      certificateId: certificate._id.toString(),
      studentId: student._id.toString(),
      certificateNumber,
      degree: s.degree,
      issueDate,
    });
    certificate.qrCode = await generateQrDataUrl(certificateNumber);
    const chainResult = await issueCertificateOnChain(certificate.hash, certificate._id.toString());
    await certificate.save();
    await BlockchainTransaction.create({
      certificate: certificate._id,
      txHash: chainResult.txHash,
      blockNumber: chainResult.blockNumber,
      contractAddress: chainResult.contractAddress,
      simulated: chainResult.simulated,
    });

    console.log(`[seed] Issued ${certificateNumber} to ${s.name}`);
  }

  console.log(`[seed] Admin login: admin@svu.edu / admin123`);
  console.log(`[seed] Student login: amina.yusuf@svu.edu / student123`);
  console.log("[seed] Done.");
  process.exit(0);
}

seed().catch((err) => {
  console.error("[seed] Failed:", err);
  process.exit(1);
});
