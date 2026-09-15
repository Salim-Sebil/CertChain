const mongoose = require("mongoose");

/** Connects to MongoDB Atlas per Section 2.14 / 4.4.5. Fails loudly and
 *  exits on startup if the connection can't be established, rather than
 *  letting the server come up in a half-working state. */
async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not set. Copy .env.example to .env and fill it in.");
  }

  mongoose.set("strictQuery", true);

  await mongoose.connect(uri);

  console.log(`[db] Connected to MongoDB (${mongoose.connection.name})`);

  mongoose.connection.on("error", (err) => {
    console.error("[db] Connection error:", err.message);
  });
  mongoose.connection.on("disconnected", () => {
    console.warn("[db] Disconnected from MongoDB");
  });
}

module.exports = connectDB;
