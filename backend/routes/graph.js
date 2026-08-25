import { Router } from "express";
import { runQuery } from "../db/connection.js";

export const router = Router();

// Small helper to keep route handlers tidy and give consistent
// graceful error responses if CognoDB is unreachable.
function handle(queryFn) {
  return async (req, res) => {
    try {
      const data = await queryFn(req);
      res.json(data);
    } catch (err) {
      console.error("Query failed:", err.message);
      res.status(503).json({
        error: "The database is temporarily unavailable. Please try again shortly.",
      });
    }
  };
}

// GET /api/users — list all users (simple, single-hop)
router.get(
  "/users",
  handle(async () => {
    const records = await runQuery(
      "MATCH (u:User) RETURN u.id AS id, u.name AS name, u.role AS role ORDER BY u.name"
    );
    return records.map((r) => r.toObject());
  })
);

// GET /api/resources — list all resources
router.get(
  "/resources",
  handle(async () => {
    const records = await runQuery(
      "MATCH (r:Resource) RETURN r.id AS id, r.name AS name, r.sensitivity AS sensitivity ORDER BY r.name"
    );
    return records.map((r) => r.toObject());
  })
);

// GET /api/users/:id/direct-access — resources a user can reach in one hop
// through their role. This is the kind of query that's still easy in SQL.
router.get(
  "/users/:id/direct-access",
  handle(async (req) => {
    const records = await runQuery(
      `MATCH (u:User {id: $userId})-[:HAS_ROLE]->(:Role)-[:GRANTS_ACCESS]->(res:Resource)
       RETURN DISTINCT res.id AS id, res.name AS name, res.sensitivity AS sensitivity`,
      { userId: req.params.id }
    );
    return records.map((r) => r.toObject());
  })
);

// GET /api/users/:id/attack-paths
// THE key multi-hop query: starting from a user, find every path
// (through role escalation and machine lateral movement) that could
// eventually reach a "critical" sensitivity resource. This is a
// variable-length, multi-relationship-type traversal that a relational
// database would need recursive CTEs and multiple joins to approximate,
// and it gets slower as the org grows — the graph query stays natural.
router.get(
  "/users/:id/attack-paths",
  handle(async (req) => {
    const records = await runQuery(
      `MATCH path = (u:User {id: $userId})-[:HAS_ROLE|LOGS_INTO|CONNECTS_TO|CAN_ASSUME|GRANTS_ACCESS|HOSTS*1..6]->(target:Resource)
       WHERE target.sensitivity = "critical"
       RETURN
         [n IN nodes(path) | coalesce(n.name, n.id)] AS nodeNames,
         [n IN nodes(path) | labels(n)[0]] AS nodeLabels,
         [r IN relationships(path) | type(r)] AS relTypes,
         length(path) AS hops
       ORDER BY hops ASC
       LIMIT 10`,
      { userId: req.params.id }
    );
    return records.map((r) => r.toObject());
  })
);

// GET /api/graph — full graph for visualization (nodes + edges)
router.get(
  "/graph",
  handle(async () => {
    const nodeRecords = await runQuery(
      "MATCH (n) RETURN n.id AS id, n.name AS name, labels(n)[0] AS label"
    );
    const edgeRecords = await runQuery(
      "MATCH (a)-[r]->(b) RETURN a.id AS source, b.id AS target, type(r) AS type"
    );
    return {
      nodes: nodeRecords.map((r) => r.toObject()),
      edges: edgeRecords.map((r) => r.toObject()),
    };
  })
);
