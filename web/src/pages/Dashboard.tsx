import { useEffect, useState } from "react";

type FilterMode = "all" | "pending" | "ai" | "staff";

type Callback = {
  id: string;
  name: string;
  phone: string;
  status: string;
  source?: string;
  createdAt: string;

  // Phase 4 fields
  aiHandled?: boolean;
  aiOutcome?: string | null;
  staffFollowupRequired?: boolean;
  summary?: string | null;
};

export default function Dashboard() {
  const [callbacks, setCallbacks] = useState<Callback[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<FilterMode>("all");

  useEffect(() => {
    const fetchCallbacks = async () => {
      try {
        const res = await fetch("/api/callbacks");
        const data = await res.json();
        setCallbacks(data);
        setLastUpdated(new Date());
        setLoading(false);
      } catch (err) {
        console.error("Failed to fetch callbacks", err);
        setLoading(false);
      }
    };

  // initial load
  fetchCallbacks();

  // auto-refresh every 15s
  const interval = setInterval(fetchCallbacks, 15000);

  // cleanup
  return () => clearInterval(interval);
}, []);

  const todayCount = callbacks.filter(cb => {
    const created = new Date(cb.createdAt);
    const now = new Date();
    return (
      created.getFullYear() === now.getFullYear() &&
      created.getMonth() === now.getMonth() &&
      created.getDate() === now.getDate()
    );
  }).length;

  const filtered = callbacks
    .filter(cb =>
      `${cb.name} ${cb.phone}`.toLowerCase().includes(query.toLowerCase())
    )
    .filter(cb => {
      switch (filterMode) {
        case "pending":
          return cb.status === "pending";
        case "ai":
          return cb.aiHandled === true;
        case "staff":
          return cb.staffFollowupRequired === true;
        default:
          return true;
      }
    });

  async function attemptAiCallback(id: string) {
    try {
      setLoadingId(id);

      const res = await fetch(`/api/callbacks/${id}/ai-call`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ simulatedReason: "scheduling" }),
      });

      if (!res.ok) throw new Error("AI callback failed");

      const updated = await fetch("/api/callbacks").then(r => r.json());
      setCallbacks(updated);
    } catch (err) {
      console.error("AI callback error", err);
      alert("AI callback attempt failed");
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-semibold mb-1">VetCan Admin Dashboard</h1>

      {lastUpdated && (
        <small className="block text-gray-400 mb-2">
          Auto-refreshing • Last update {lastUpdated.toLocaleTimeString()}
        </small>
      )}

      <p className="text-gray-500 mb-6">Welcome to the control center.</p>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="p-4 border rounded bg-white">
          <div className="text-sm text-gray-500">Callbacks Today</div>
          <div className="text-3xl font-bold">{todayCount}</div>
        </div>
        <div className="p-4 border rounded bg-white">
          <div className="text-sm text-gray-500">Completion Rate</div>
          <div className="text-3xl font-bold">
            {Math.round(
              (callbacks.filter(c => c.status === "completed").length /
                Math.max(callbacks.length, 1)) * 100
            )}%
          </div>
        </div>
        <div className="p-4 border rounded bg-white">
          <div className="text-sm text-gray-500">Pending</div>
          <div className="text-3xl font-bold">
            {callbacks.filter(c => c.status === "pending").length}
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-4">
        {[
          { key: "all", label: "All" },
          { key: "pending", label: "Pending" },
          { key: "ai", label: "🤖 AI Handled" },
          { key: "staff", label: "⚠️ Needs Staff" },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilterMode(tab.key as FilterMode)}
            className={`px-3 py-1 rounded text-sm border ${
              filterMode === tab.key
                ? "bg-indigo-600 text-white border-indigo-600"
                : "bg-white text-gray-700 hover:bg-gray-100"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Search by name or phone"
        value={query}
        onChange={e => setQuery(e.target.value)}
        className="mb-4 w-full max-w-sm rounded border px-3 py-2"
      />

      {/* Table */}
      {loading ? (
        <p className="text-gray-500">Loading callbacks…</p>
      ) : filtered.length === 0 ? (
        <p className="text-gray-500">No callback requests yet.</p>
      ) : (
        <table className="w-full border rounded text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th>Name</th>
              <th>Phone</th>
              <th>Status</th>
              <th>AI</th>
              <th>Staff</th>
              <th>Summary</th>
              <th>Created</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(cb => (
              <tr key={cb.id} className="border-t">
                <td>{cb.name}</td>
                <td>{cb.phone}</td>
                <td>{cb.status}</td>
                <td>{cb.aiHandled ? "🤖" : "—"}</td>
                <td>{cb.staffFollowupRequired ? "⚠️" : "—"}</td>
                <td title={cb.summary ?? ""}>
                  {cb.summary ?? "—"}
                </td>
                <td>{new Date(cb.createdAt).toLocaleString()}</td>
                <td>
                  {cb.status === "pending" ? (
                    <button
                      onClick={() => attemptAiCallback(cb.id)}
                      disabled={loadingId === cb.id}
                      className="px-2 py-1 bg-indigo-600 text-white rounded"
                    >
                      {loadingId === cb.id ? "Calling AI…" : "Attempt AI Callback"}
                    </button>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p className="mt-6 text-xs text-gray-400">
        Data refreshes in real time.
      </p>
    </div>
  );
}
