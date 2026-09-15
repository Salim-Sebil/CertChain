const express = require("express");
const { getSummary } = require("../controllers/reportController");
const { protect, restrictTo } = require("../middleware/auth");

const router = express.Router();

router.get("/summary", protect, restrictTo("admin"), getSummary);

module.exports = router;
