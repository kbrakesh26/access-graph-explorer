import { useEffect, useState } from "react";

// Small reusable status wrapper so every panel handles
// loading / empty / error the same way.
function StatusPanel({ loading, error, isEmpty, emptyText, children }) {
  if (loading) {
    return <p className="text-sm text-slate-400 animate-pulse">Loading…</p>;
  }
  if (error) {
    return (
      <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-3">
        {error}
      </p>
    );
  }
  if (isEmpty) {
    return <p className="text-sm text-slate-400 italic">{emptyText}</p>;
  }
  return children;
}

function useApi(path, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(path)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || "Something went wrong.");
        }
        return res.json();
      })
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading, error };
}

const sensitivityColor = {
  low: "bg-slate-100 text-slate-700",
  medium: "bg-amber-100 text-amber-800",
  high: "bg-orange-100 text-orange-800",
  critical: "bg-red-100 text-red-800",
};

const API_BASE = import.meta.env.VITE_API_URL || "";

export default function App() {
  const { data: users, loading: usersLoading, error: usersError } = useApi(
    `${API_BASE}/api/users`,
    []
  );
  const [selectedUser, setSelectedUser] = useState(null);

  const {
    data: directAccess,
    loading: directLoading,
    error: directError,
  } = useApi(
  selectedUser ? `${API_BASE}/api/users/${selectedUser}/direct-access` : null,
  [selectedUser]
  );

  const {
    data: attackPaths,
    loading: pathsLoading,
    error: pathsError,
  } = useApi(
  selectedUser ? `${API_BASE}/api/users/${selectedUser}/attack-paths` : null,
  [selectedUser]
 );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <h1 className="text-xl font-semibold">Access Graph Explorer</h1>
        <p className="text-sm text-slate-500">
          Trace what a user can reach directly — and what an attacker could
          reach through them.
        </p>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-8 space-y-8">
        {/* User selector */}
        <section>
          <h2 className="text-sm font-medium text-slate-500 mb-2">
            Select a user
          </h2>
          <StatusPanel
            loading={usersLoading}
            error={usersError}
            isEmpty={users && users.length === 0}
            emptyText="No users found. Have you run the seed script?"
          >
            <div className="flex flex-wrap gap-2">
              {users?.map((u) => (
                <button
                  key={u.id}
                  onClick={() => setSelectedUser(u.id)}
                  className={`px-3 py-1.5 rounded-full text-sm border transition ${
                    selectedUser === u.id
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-white text-slate-700 border-slate-300 hover:border-slate-400"
                  }`}
                >
                  {u.name}{" "}
                  <span className="text-xs opacity-60">({u.role})</span>
                </button>
              ))}
            </div>
          </StatusPanel>
        </section>

        {!selectedUser && (
          <p className="text-sm text-slate-400 italic">
            Pick a user above to see what they can access.
          </p>
        )}

        {selectedUser && (
          <>
            {/* Direct access — single hop */}
            <section>
              <h2 className="text-sm font-medium text-slate-500 mb-2">
                Direct access (1 hop via role)
              </h2>
              <StatusPanel
                loading={directLoading}
                error={directError}
                isEmpty={directAccess && directAccess.length === 0}
                emptyText="This user has no direct resource access."
              >
                <ul className="space-y-1">
                  {directAccess?.map((r) => (
                    <li
                      key={r.id}
                      className="flex items-center justify-between bg-white border border-slate-200 rounded-md px-3 py-2 text-sm"
                    >
                      <span>{r.name}</span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          sensitivityColor[r.sensitivity] ||
                          "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {r.sensitivity}
                      </span>
                    </li>
                  ))}
                </ul>
              </StatusPanel>
            </section>

            {/* Attack paths — multi-hop traversal */}
            <section>
              <h2 className="text-sm font-medium text-slate-500 mb-2">
                Possible paths to critical resources (multi-hop)
              </h2>
              <StatusPanel
                loading={pathsLoading}
                error={pathsError}
                isEmpty={attackPaths && attackPaths.length === 0}
                emptyText="No path found to any critical resource. This user looks contained."
              >
                <div className="space-y-2">
                  {attackPaths?.map((p, i) => (
                    <div
                      key={i}
                      className="bg-white border border-slate-200 rounded-md px-3 py-2 text-sm"
                    >
                      <div className="flex flex-wrap items-center gap-1">
                        {p.nodeNames.map((name, idx) => (
                          <span key={idx} className="flex items-center gap-1">
                            <span className="px-2 py-0.5 bg-slate-100 rounded">
                              {name}
                            </span>
                            {idx < p.relTypes.length && (
                              <span className="text-xs text-slate-400">
                                —{p.relTypes[idx]}→
                              </span>
                            )}
                          </span>
                        ))}
                      </div>
                      <p className="text-xs text-slate-400 mt-1">
                        {p.hops} hop{p.hops === 1 ? "" : "s"}
                      </p>
                    </div>
                  ))}
                </div>
              </StatusPanel>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
