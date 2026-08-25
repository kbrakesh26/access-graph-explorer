import neo4j from "neo4j-driver";
import dotenv from "dotenv";

dotenv.config();

const { COGNODB_URI, COGNODB_USER, COGNODB_PASSWORD } = process.env;

if (!COGNODB_URI || !COGNODB_USER || !COGNODB_PASSWORD) {
  console.error(
    "Missing CognoDB connection details. Check your .env file against .env.example."
  );
}

// Single shared driver instance for the whole app.
export const driver = neo4j.driver(
  COGNODB_URI,
  neo4j.auth.basic(COGNODB_USER, COGNODB_PASSWORD),
  {
    maxConnectionPoolSize: 20,
    disableLosslessIntegers: true,
  }
);

// Call this once at startup to fail fast with a clear message
// instead of a confusing error on the first request.
export async function verifyConnection() {
  try {
    await driver.verifyConnectivity();
    console.log("Connected to CognoDB successfully.");
  } catch (err) {
    console.error("Could not connect to CognoDB:", err.message);
    throw err;
  }
}

// Helper: run a query in a managed session and always close it,
// even if the query throws.
export async function runQuery(cypher, params = {}) {
  const session = driver.session();
  try {
    const result = await session.run(cypher, params);
    return result.records;
  } finally {
    await session.close();
  }
}
