import { useEffect, useState } from "react";

type MetricsResponse = {
  uptimeSeconds: number;
  environment: string;
  eventCounts: Record<string, number>;
  activeAlerts: Array<{
    alertType: string;
    eventName: string;
    count: number;
    threshold: number;
    windowSeconds: number;
    triggeredAt: string;
    environment: string;
  }>;
};

export default function MetricsDashboard() {
  const [metrics, setMetrics] = useState<MetricsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchMetrics = async () => {
      try {
        const res = await fetch("/api/internal/metrics");
        if (!res.ok) {
          console.warn(`[metrics] HTTP ${res.status}`);
          throw new Error("Metrics request failed");
        }
        const data: MetricsResponse = await res.json();
        if (!isMounted) return;
        setMetrics(data);
        setLastUpdated(new Date().toLocaleTimeString());
        setError(null);
      } catch {
        if (!isMounted) return;
        setError("Unable to load metrics.");
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 5000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const uptime = metrics?.uptimeSeconds ?? 0;
  const hours = Math.floor(uptime / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  const seconds = Math.floor(uptime % 60);
  const uptimeLabel = `${hours}h ${minutes}m ${seconds}s`;

  const eventEntries = Object.entries(metrics?.eventCounts || {}).sort(
    (a, b) => b[1] - a[1]
  );

  return (
    <div
      style={{
        minHeight: "100vh",
        color: "#1b1b1b",
        background:
          "radial-gradient(circle at 10% 20%, rgba(255, 229, 210, 0.7), transparent 50%), radial-gradient(circle at 85% 10%, rgba(186, 225, 255, 0.6), transparent 45%), linear-gradient(180deg, #f7f4ef, #f1efe9 60%, #f9f6f0)",
        fontFamily: '"Palatino Linotype", "Book Antiqua", Palatino, serif',
        padding: "32px",
      }}
    >
      <main
        style={{
          maxWidth: "1100px",
          margin: "0 auto",
          background: "rgba(255, 255, 255, 0.82)",
          borderRadius: "18px",
          padding: "28px 32px",
          boxShadow: "0 18px 60px rgba(24, 28, 34, 0.12)",
          border: "1px solid rgba(28, 28, 28, 0.08)",
        }}
      >
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: "16px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <p
              style={{
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                fontSize: "12px",
                margin: 0,
              }}
            >
              VetCan Ops Console
            </p>
            <h1 style={{ fontSize: "30px", margin: "8px 0 6px" }}>
              Internal Metrics
            </h1>
            <p style={{ margin: 0, color: "#5a524b" }}>
              Environment: <strong>{metrics?.environment || "local"}</strong>
            </p>
          </div>
          <div style={{ textAlign: "right" }}>
            <p style={{ margin: 0, fontSize: "14px", color: "#5a524b" }}>
              Uptime
            </p>
            <p style={{ margin: "6px 0 0", fontSize: "22px" }}>
              {uptimeLabel}
            </p>
            <p style={{ margin: "6px 0 0", fontSize: "12px", color: "#7b726a" }}>
              Last updated {lastUpdated || "—"}
            </p>
          </div>
        </header>

        <section style={{ marginTop: "28px" }}>
          <h2 style={{ fontSize: "20px", marginBottom: "12px" }}>
            Active Alerts
          </h2>
          {loading && <p style={{ color: "#7b726a" }}>Loading metrics...</p>}
          {error && <p style={{ color: "#a23e3e" }}>{error}</p>}
          {!loading && !error && (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ textAlign: "left", background: "#f0ebe4" }}>
                    <th style={{ padding: "10px", borderBottom: "1px solid #d9d2c7" }}>
                      Alert
                    </th>
                    <th style={{ padding: "10px", borderBottom: "1px solid #d9d2c7" }}>
                      Event
                    </th>
                    <th style={{ padding: "10px", borderBottom: "1px solid #d9d2c7" }}>
                      Count
                    </th>
                    <th style={{ padding: "10px", borderBottom: "1px solid #d9d2c7" }}>
                      Threshold
                    </th>
                    <th style={{ padding: "10px", borderBottom: "1px solid #d9d2c7" }}>
                      Window
                    </th>
                    <th style={{ padding: "10px", borderBottom: "1px solid #d9d2c7" }}>
                      Triggered
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(metrics?.activeAlerts || []).length === 0 && (
                    <tr>
                      <td
                        style={{ padding: "14px 10px", color: "#7b726a" }}
                        colSpan={6}
                      >
                        No active alerts.
                      </td>
                    </tr>
                  )}
                  {(metrics?.activeAlerts || []).map((alert) => (
                    <tr key={`${alert.alertType}-${alert.eventName}`}>
                      <td style={{ padding: "12px 10px", borderBottom: "1px solid #efe7dd" }}>
                        {alert.alertType}
                      </td>
                      <td style={{ padding: "12px 10px", borderBottom: "1px solid #efe7dd" }}>
                        {alert.eventName}
                      </td>
                      <td style={{ padding: "12px 10px", borderBottom: "1px solid #efe7dd" }}>
                        {alert.count}
                      </td>
                      <td style={{ padding: "12px 10px", borderBottom: "1px solid #efe7dd" }}>
                        {alert.threshold}
                      </td>
                      <td style={{ padding: "12px 10px", borderBottom: "1px solid #efe7dd" }}>
                        {alert.windowSeconds}s
                      </td>
                      <td style={{ padding: "12px 10px", borderBottom: "1px solid #efe7dd" }}>
                        {new Date(alert.triggeredAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section style={{ marginTop: "28px" }}>
          <h2 style={{ fontSize: "20px", marginBottom: "12px" }}>
            Event Counts
          </h2>
          {!loading && !error && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: "12px",
              }}
            >
              {eventEntries.length === 0 && (
                <p style={{ color: "#7b726a", margin: 0 }}>
                  No events recorded yet.
                </p>
              )}
              {eventEntries.map(([eventName, count]) => (
                <article
                  key={eventName}
                  style={{
                    padding: "14px 16px",
                    borderRadius: "14px",
                    background: "#f9f4ee",
                    border: "1px solid #e4dbd0",
                  }}
                >
                  <p
                    style={{
                      margin: 0,
                      fontSize: "12px",
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: "#7b726a",
                    }}
                  >
                    {eventName}
                  </p>
                  <p style={{ margin: "8px 0 0", fontSize: "22px" }}>{count}</p>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
