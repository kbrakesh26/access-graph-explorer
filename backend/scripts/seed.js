// Loads a small but realistic access-graph dataset into CognoDB.
// Run with: npm run seed

import { driver, verifyConnection } from "../db/connection.js";

const users = [
  { id: "u1", name: "Alice", role: "intern" },
  { id: "u2", name: "Bob", role: "developer" },
  { id: "u3", name: "Carol", role: "sysadmin" },
  { id: "u4", name: "Dave", role: "developer" },
  { id: "u5", name: "Eve", role: "attacker-entrypoint" }, // e.g. phished account
];

const roles = [
  { id: "r1", name: "intern" },
  { id: "r2", name: "developer" },
  { id: "r3", name: "sysadmin" },
  { id: "r4", name: "admin" },
];

const resources = [
  { id: "res1", name: "Internal Wiki", sensitivity: "low" },
  { id: "res2", name: "Source Code Repo", sensitivity: "medium" },
  { id: "res3", name: "CI/CD Server", sensitivity: "high" },
  { id: "res4", name: "Production Database", sensitivity: "critical" },
  { id: "res5", name: "Admin Console", sensitivity: "critical" },
];

const machines = [
  { id: "m1", name: "Alice-Laptop" },
  { id: "m2", name: "Bob-Laptop" },
  { id: "m3", name: "Build-Server" },
  { id: "m4", name: "DB-Host" },
];

// Each edge: [fromId, relType, toId]
const edges = [
  // Users belong to roles
  ["u1", "HAS_ROLE", "r1"],
  ["u2", "HAS_ROLE", "r2"],
  ["u3", "HAS_ROLE", "r3"],
  ["u4", "HAS_ROLE", "r2"],
  ["u5", "HAS_ROLE", "r1"], // Eve looks like a low-privilege intern account

  // Roles grant access to resources
  ["r1", "GRANTS_ACCESS", "res1"],
  ["r2", "GRANTS_ACCESS", "res1"],
  ["r2", "GRANTS_ACCESS", "res2"],
  ["r3", "GRANTS_ACCESS", "res3"],
  ["r3", "GRANTS_ACCESS", "res4"],
  ["r4", "GRANTS_ACCESS", "res5"],

  // Users log into machines
  ["u1", "LOGS_INTO", "m1"],
  ["u2", "LOGS_INTO", "m2"],
  ["u5", "LOGS_INTO", "m1"], // Eve shares a machine with Alice (misconfigured shared laptop)

  // Machines are network-connected (lateral movement paths)
  ["m1", "CONNECTS_TO", "m3"],
  ["m3", "CONNECTS_TO", "m4"],
  ["m2", "CONNECTS_TO", "m3"],

  // Machines host / provide access to resources
  ["m3", "HOSTS", "res3"],
  ["m4", "HOSTS", "res4"],

  // Privilege escalation path: sysadmin role can assume admin role
  ["r3", "CAN_ASSUME", "r4"],
];

async function seed() {
  await verifyConnection();
  const session = driver.session();

  try {
    console.log("Clearing existing data...");
    await session.run("MATCH (n) DETACH DELETE n");

    console.log("Creating User nodes...");
    for (const u of users) {
      await session.run(
        "CREATE (:User {id: $id, name: $name, role: $role})",
        u
      );
    }

    console.log("Creating Role nodes...");
    for (const r of roles) {
      await session.run("CREATE (:Role {id: $id, name: $name})", r);
    }

    console.log("Creating Resource nodes...");
    for (const res of resources) {
      await session.run(
        "CREATE (:Resource {id: $id, name: $name, sensitivity: $sensitivity})",
        res
      );
    }

    console.log("Creating Machine nodes...");
    for (const m of machines) {
      await session.run("CREATE (:Machine {id: $id, name: $name})", m);
    }

    console.log("Creating relationships...");
    for (const [fromId, relType, toId] of edges) {
      // relType is from a fixed internal array (never user input), so it's
      // safe to interpolate here; all IDs are still passed as parameters.
      await session.run(
        `MATCH (a {id: $fromId}), (b {id: $toId})
         CREATE (a)-[:${relType}]->(b)`,
        { fromId, toId }
      );
    }

    console.log("Seed complete.");
  } finally {
    await session.close();
    await driver.close();
  }
}

seed().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
