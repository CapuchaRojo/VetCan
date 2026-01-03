import { useEffect, useState } from "react";

type Callback = {
  id: string;
  name: string;
  phone: string;
  status: string;
  source?: string;
  createdAt: string;
};

export default function Dashboard() {
  const [callbacks, setCallbacks] = useState<Callback[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    fetch("/api/callbacks")
      .then((res) => res.json())
      .then((data) => {
        setCallbacks(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load callbacks", err);
        setLoading(false);
      });
  }, []);

  function markCompleted(id: string) {
    fetch(`/api/callbacks/${id}/complete`, { method: "POST" }).then(() => {
      setCallbacks((prev) =>
        prev.map((cb) =>
          cb.id === id ? { ...cb, status: "completed" } : cb
        )
      );
    });
  }

  const todayCount = callbacks.filter((cb) => {
    const created = new Date(cb.createdAt);
    const now = new Date();
    return (
      created.getFullYear() === now.getFullYear() &&
      created.getMonth() === now.getMonth() &&
      created.getDate() === now.getDate()
    );
  }).length;

  const filtered = callbacks.filter((cb) =>
    `${cb.name} ${cb.phone}`.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div style={{ padding: 24 }}>
      <h1 className="text-2xl font-bold">VetCan Admin Dashboard</h1>
      <p style={{ marginBottom: 16 }}>Welcome to the control center.</p>

      <p style={{ marginBottom: 8 }}>📊 Callbacks today: {todayCount}</p>

      <input
        placeholder="Search name or phone…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        style={{
          padding: 8,
          marginBottom: 12,
          width: 300,
        }}
      />

      {loading ? (
        <p>Loading…</p>
      ) : filtered.length === 0 ? (
        <p>No callback requests yet.</p>
      ) : (
        <table width="100%" cellPadding={6}>
          <thead>
            <tr>
              <th align="left">Name</th>
              <th align="left">Phone</th>
              <th align="left">Status</th>
              <th align="left">Source</th>
              <th align="left">Created</th>
              <th align="left">Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((cb) => (
              <tr key={cb.id}>
                <td>{cb.name}</td>
                <td>{cb.phone}</td>
                <td>{cb.status}</td>
                <td>
                  <span
                    style={{
                      padding: "2px 8px",
                      borderRadius: 4,
                      background:
                        cb.source === "sms" ? "#e0f2fe" : "#eee",
                      fontSize: 12,
                    }}
                  >
                    {cb.source ?? "unknown"}
                  </span>
                </td>
                <td>
                  {new Date(cb.createdAt).toLocaleString()}
                </td>
                <td>
                  {cb.status === "pending" ? (
                    <button
                      onClick={() => markCompleted(cb.id)}
                      style={{
                        padding: "4px 8px",
                        borderRadius: 4,
                        background: "#22c55e",
                        color: "white",
                        border: "none",
                        cursor: "pointer",
                      }}
                    >
                      Mark Completed
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
    </div>
  );
}
