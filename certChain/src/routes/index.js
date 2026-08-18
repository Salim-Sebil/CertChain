const express = require("express");
const authRoutes = require("./authRoutes");
const studentRoutes = require("./studentRoutes");
const certificateRoutes = require("./certificateRoutes");
const reportRoutes = require("./reportRoutes");

const router = express.Router();

router.get("/health", (req, res) => res.json({ success: true, status: "ok", time: new Date().toISOString() }));

router.use("/auth", authRoutes);
router.use("/students", studentRoutes);
router.use("/certificates", certificateRoutes);
router.use("/reports", reportRoutes);

module.exports = router;
