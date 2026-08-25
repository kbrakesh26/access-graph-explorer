import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { verifyConnection } from "./db/connection.js";
import { router as graphRouter } from "./routes/graph.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => res.json({ status: "ok" }));
app.use("/api", graphRouter);

const PORT = process.env.PORT || 4000;

async function start() {
  try {
    await verifyConnection();
  } catch {
    console.error(
      "Starting server anyway — API routes will return 503 until CognoDB is reachable."
    );
  }
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

start();
