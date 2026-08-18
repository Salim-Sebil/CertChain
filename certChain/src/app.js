const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const apiRouter = require("./routes");
const { errorHandler, notFound } = require("./middleware/errorHandler");

function createApp() {
  const app = express();

  // Trust the first proxy hop (needed for req.ip to be accurate behind
  // a load balancer / reverse proxy in production).
  app.set("trust proxy", 1);

  app.use(helmet());
  app.use(
    cors({
      origin: (process.env.CORS_ORIGIN || "*").split(",").map((s) => s.trim()),
    })
  );
  app.use(express.json({ limit: "1mb" }));
  if (process.env.NODE_ENV !== "test") {
    app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
  }

  app.use("/api", apiRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = createApp;
