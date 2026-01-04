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
  const [loading, setLoading] = useState<boolean>(true);
  const [query, setQuery] = useState<string>("");

  useEffect(() => {
    fetch("/api/callbacks")
      .then((res) => res.json())
      .then((data: Callback[]) => {
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
      setCallbacks((prev: Callback[]) =>
        prev.map((cb: Callback) =>
          cb.id === id ? { ...cb, status: "completed" } : cb
        )
      );
    });
  }

  const todayCount = callbacks.filter((cb: Callback) => {
    const created = new Date(cb.createdAt);
    const now = new Date();
    return (
      created.getFullYear() === now.getFullYear() &&
      created.getMonth() === now.getMonth() &&
      created.getDate() === now.getDate()
    );
  }).length;

  const filtered = callbacks.filter((cb: Callback) =>
    `${cb.name} ${cb.phone}`.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <h1 className="text-2xl font-semibold mb-1">
        VetCan Admin Dashboard
      </h1>
      <p className="text-gray-500 mb-6">
        Welcome to the control center.
      </p>

      {/* Stats */}
      <div className="mb-6">
        <div className="text-sm text-gray-500">
          Callbacks today
        </div>
        <div className="text-3xl font-bold">
          {todayCount}
        </div>
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Search by name or phone"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="mb-4 w-full max-w-sm rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring focus:ring-blue-200"
      />

      {/* Table / States */}
      {loading ? (
        <p className="text-gray-500">Loading callbacks…</p>
      ) : filtered.length === 0 ? (
        <p className="text-gray-500">
          No callback requests yet.
        </p>
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="border-b py-2 text-left font-medium text-gray-600">
                Name
              </th>
              <th className="border-b py-2 text-left font-medium text-gray-600">
                Phone
              </th>
              <th className="border-b py-2 text-left font-medium text-gray-600">
                Status
              </th>
              <th className="border-b py-2 text-left font-medium text-gray-600">
                Source
              </th>
              <th className="border-b py-2 text-left font-medium text-gray-600">
                Created
              </th>
              <th className="border-b py-2 text-left font-medium text-gray-600">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((cb: Callback) => (
              <tr key={cb.id}>
                <td className="py-2 border-b">{cb.name}</td>
                <td className="py-2 border-b">{cb.phone}</td>
                <td className="py-2 border-b">{cb.status}</td>
                <td className="py-2 border-b">
                  <span
                    className={`px-2 py-1 rounded text-xs ${
                      cb.source === "sms"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {cb.source ?? "unknown"}
                  </span>
                </td>
                <td className="py-2 border-b">
                  {new Date(cb.createdAt).toLocaleString()}
                </td>
                <td className="py-2 border-b">
                  {cb.status === "pending" ? (
                    <button
                      onClick={() => markCompleted(cb.id)}
                      className="rounded bg-green-500 px-2 py-1 text-white text-xs hover:bg-green-600"
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
