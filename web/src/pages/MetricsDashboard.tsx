import { useEffect, useState } from "react";
import { apiFetch } from "../lib/apiFetch";

type MetricsResponse = {
  uptimeSeconds: number;
  environment: string;
  lastUpdated: string;
  eventCounts: Record<string, number>;
  ackTimeline: Array<{
    eventName: string;
    createdAt: string;
    payload: Record<string, any>;
  }>;
  sla: {
    callbacks: {
      averageSeconds: number;
      breachCount: number;
      buckets: { le2m: number; le5m: number; le10m: number; gt10m: number };
    };
    alerts: {
      averageSeconds: number;
      breachCount: number;
      buckets: { le2m: number; le5m: number; le10m: number; gt10m: number };
    };
  };
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

type StatusResponse = {
  uptimeSeconds: number;
  environment: string;
  alertEngineInitialized: boolean;
  activeAlertCount: number;
  eventForwarderEnabled: boolean;
};

type RecentEvent = {
  type: string;
  payload: Record<string, any>;
  createdAt: string;
};

type FilterMode = "all" | "pending" | "ai" | "staff";

type Callback = {
  id: string;
  name: string;
  phone: string;
  status: string;
  source?: string;
  createdAt: string;
  aiHandled?: boolean;
  aiOutcome?: string | null;
  staffFollowupRequired?: boolean;
  summary?: string | null;
};

type ActiveAlert = {
  id: string;
  alertType: string;
  eventName: string;
  count: number;
  threshold: number;
  firstTriggeredAt: string;
  acknowledgedAt?: string;
};

const tableHeaderStyle = {
  padding: "10px",
  borderBottom: "1px solid #d9d2c7",
};

const tableCellStyle = {
  padding: "12px 10px",
  borderBottom: "1px solid #efe7dd",
};

function SectionTitle({ children }: { children: string }) {
  return (
    <h2 style={{ fontSize: "20px", marginBottom: "12px" }}>
      {children}
    </h2>
  );
}

export default function MetricsDashboard() {
  const [metrics, setMetrics] = useState<MetricsResponse | null>(null);
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [recentEvents, setRecentEvents] = useState<RecentEvent[]>([]);
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [metricsError, setMetricsError] = useState<string | null>(null);
  const [metricsUpdatedAt, setMetricsUpdatedAt] = useState<string | null>(null);

  const [callbacks, setCallbacks] = useState<Callback[]>([]);
  const [callbacksLoading, setCallbacksLoading] = useState(true);
  const [callbacksUpdatedAt, setCallbacksUpdatedAt] = useState<Date | null>(null);
  const [query, setQuery] = useState("");
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [recentlyUpdatedId, setRecentlyUpdatedId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [demoIds, setDemoIds] = useState<Set<string>>(new Set());
  const [alerts, setAlerts] = useState<ActiveAlert[]>([]);
  const [alertsError, setAlertsError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchMetrics = async () => {
      try {
        const res = await apiFetch("/api/internal/metrics");
        if (!res.ok) {
          console.warn(`[metrics] HTTP ${res.status}`);
          throw new Error("Metrics request failed");
        }
        const data: MetricsResponse = await res.json();
        if (!isMounted) return;
        setMetrics(data);
        setMetricsUpdatedAt(new Date().toLocaleTimeString());
        setMetricsError(null);
      } catch {
        if (!isMounted) return;
        setMetricsError("Unable to load metrics.");
      } finally {
        if (isMounted) {
          setMetricsLoading(false);
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

  useEffect(() => {
    let isMounted = true;
    const fetchStatus = async () => {
      try {
        const res = await apiFetch("/api/internal/status");
        if (!res.ok) {
          throw new Error("Status request failed");
        }
        const data: StatusResponse = await res.json();
        if (!isMounted) return;
        setStatus(data);
      } catch {
        if (!isMounted) return;
        setStatus(null);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    const fetchRecentEvents = async () => {
      try {
        const res = await apiFetch("/api/internal/events/recent?limit=50");
        if (!res.ok) {
          throw new Error("Recent events request failed");
        }
        const data: { events: RecentEvent[] } = await res.json();
        if (!isMounted) return;
        setRecentEvents(data.events || []);
      } catch {
        if (!isMounted) return;
        setRecentEvents([]);
      }
    };

    fetchRecentEvents();
    const interval = setInterval(fetchRecentEvents, 5000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const fetchCallbacks = async () => {
      try {
        const res = await apiFetch("/api/callbacks");
        const data: Callback[] = await res.json();

        setCallbacks(data);

        if (data.length > 0) {
          setRecentlyUpdatedId(data[0].id);
          setTimeout(() => setRecentlyUpdatedId(null), 2000);
        }

        setCallbacksUpdatedAt(new Date());
        setCallbacksLoading(false);
      } catch (err) {
        console.error("Failed to fetch callbacks", err);
        setCallbacksLoading(false);
      }
    };

    fetchCallbacks();
    const interval = setInterval(fetchCallbacks, 15000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const res = await apiFetch("/api/internal/alerts/active");
        if (!res.ok) throw new Error("Alert fetch failed");
        const data: ActiveAlert[] = await res.json();
        setAlerts(data);
        setAlertsError(null);
      } catch (err) {
        setAlertsError("Unable to load alerts.");
      }
    };

    fetchAlerts();
    const interval = setInterval(fetchAlerts, 15000);
    return () => clearInterval(interval);
  }, []);

  const uptime = metrics?.uptimeSeconds ?? 0;
  const hours = Math.floor(uptime / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  const seconds = Math.floor(uptime % 60);
  const uptimeLabel = `${hours}h ${minutes}m ${seconds}s`;
  const activeAlertCount = metrics?.activeAlerts.length ?? 0;
  const ackTimeline = metrics?.ackTimeline || [];
  const sla = metrics?.sla;

  const eventEntries = Object.entries(metrics?.eventCounts || {}).sort(
    (a, b) => b[1] - a[1]
  );

  const alertEvents = recentEvents.filter(event =>
    ["alert_triggered", "alert_resolved", "alert_acknowledged"].includes(
      event.type
    )
  );

  const auditEvents = recentEvents.filter(event =>
    ["alert_triggered", "alert_resolved", "alert_acknowledged", "callback_marked_staff_handled"].includes(
      event.type
    )
  );

  const todayCount = callbacks.filter(cb => {
    const created = new Date(cb.createdAt);
    const now = new Date();
    return (
      created.getFullYear() === now.getFullYear() &&
      created.getMonth() === now.getMonth() &&
      created.getDate() === now.getDate()
    );
  }).length;

  const completionRate = Math.round(
    (callbacks.filter(c => c.status === "completed").length /
      Math.max(callbacks.length, 1)) * 100
  );

  const pendingCount = callbacks.filter(c => c.status === "pending").length;

  const filteredCallbacks = callbacks
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

      const res = await apiFetch(
        `/api/callbacks/${id}/ai-call?demo=true`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            demo: true,
            simulatedMedicalQuestion: false,
          }),
        }
      );

      const data = await res.json();
      if (!res.ok) throw new Error("AI callback failed");

      if (data.demo && data.callback) {
        setCallbacks(prev =>
          prev.map(cb => (cb.id === id ? data.callback : cb))
        );

        setDemoIds(prev => new Set(prev).add(id));

        setToast("Demo AI callback executed (no data saved)");
        setTimeout(() => setToast(null), 3000);
        return;
      }

      const updated = await apiFetch("/api/callbacks").then(r => r.json());
      setCallbacks(updated);
    } catch (err) {
      console.error("AI callback error", err);
      alert("AI callback attempt failed");
    } finally {
      setLoadingId(null);
    }
  }

  async function acknowledgeAlert(id: string) {
    try {
      const res = await apiFetch(`/api/internal/alerts/${id}/acknowledge`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Acknowledge failed");
      setAlerts(prev =>
        prev.map(alert =>
          alert.id === id ? { ...alert, acknowledgedAt: new Date().toISOString() } : alert
        )
      );
    } catch (err) {
      console.error("Alert acknowledge error", err);
      setAlertsError("Unable to acknowledge alert.");
    }
  }

  async function markStaffHandled(id: string) {
    try {
      const res = await apiFetch(`/api/internal/callbacks/${id}/mark-staff-handled`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Mark handled failed");
      const updated = await apiFetch("/api/callbacks").then(r => r.json());
      setCallbacks(updated);
    } catch (err) {
      console.error("Mark staff handled error", err);
    }
  }

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
      {toast && (
        <div
          style={{
            position: "fixed",
            top: "20px",
            right: "20px",
            background: "#4338ca",
            color: "#ffffff",
            padding: "10px 14px",
            borderRadius: "10px",
            boxShadow: "0 12px 24px rgba(24, 28, 34, 0.2)",
            fontSize: "14px",
            zIndex: 10,
          }}
        >
          {toast}
        </div>
      )}
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
              Unified Operations Dashboard
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
              Metrics updated {metricsUpdatedAt || "Not updated yet"}
            </p>
          </div>
        </header>

        <section style={{ marginTop: "28px" }}>
          <SectionTitle>Operations Summary</SectionTitle>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "12px",
            }}
          >
            <article
              style={{
                padding: "14px 16px",
                borderRadius: "14px",
                background: "#f9f4ee",
                border: "1px solid #e4dbd0",
              }}
            >
              <p style={{ margin: 0, fontSize: "12px", color: "#7b726a" }}>
                Callbacks Today
              </p>
              <p style={{ margin: "8px 0 0", fontSize: "22px" }}>
                {todayCount}
              </p>
            </article>
            <article
              style={{
                padding: "14px 16px",
                borderRadius: "14px",
                background: "#f9f4ee",
                border: "1px solid #e4dbd0",
              }}
            >
              <p style={{ margin: 0, fontSize: "12px", color: "#7b726a" }}>
                Completion Rate
              </p>
              <p style={{ margin: "8px 0 0", fontSize: "22px" }}>
                {completionRate}%
              </p>
            </article>
            <article
              style={{
                padding: "14px 16px",
                borderRadius: "14px",
                background: "#f9f4ee",
                border: "1px solid #e4dbd0",
              }}
            >
              <p style={{ margin: 0, fontSize: "12px", color: "#7b726a" }}>
                Pending Requests
              </p>
              <p style={{ margin: "8px 0 0", fontSize: "22px" }}>
                {pendingCount}
              </p>
            </article>
            <article
              style={{
                padding: "14px 16px",
                borderRadius: "14px",
                background: "#f9f4ee",
                border: "1px solid #e4dbd0",
              }}
            >
              <p style={{ margin: 0, fontSize: "12px", color: "#7b726a" }}>
                Active Alerts
              </p>
              <p style={{ margin: "8px 0 0", fontSize: "22px" }}>
                {activeAlertCount}
              </p>
            </article>
          </div>
          {callbacksUpdatedAt && (
            <p style={{ marginTop: "10px", fontSize: "12px", color: "#7b726a" }}>
              Callbacks updated {callbacksUpdatedAt.toLocaleTimeString()}
            </p>
          )}
        </section>

        <section style={{ marginTop: "28px" }}>
          <SectionTitle>Actionable Alerts</SectionTitle>
          {alertsError && <p style={{ color: "#a23e3e" }}>{alertsError}</p>}
          {alerts.length === 0 ? (
            <p style={{ color: "#7b726a" }}>No active alerts. System is stable.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ textAlign: "left", background: "#f0ebe4" }}>
                    <th style={tableHeaderStyle}>ID</th>
                    <th style={tableHeaderStyle}>Alert</th>
                    <th style={tableHeaderStyle}>Event</th>
                    <th style={tableHeaderStyle}>Count</th>
                    <th style={tableHeaderStyle}>Threshold</th>
                    <th style={tableHeaderStyle}>Triggered</th>
                    <th style={tableHeaderStyle}>Acknowledged</th>
                    <th style={tableHeaderStyle}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {alerts.map(alert => (
                    <tr key={alert.id}>
                      <td style={tableCellStyle}>{alert.id}</td>
                      <td style={tableCellStyle}>{alert.alertType}</td>
                      <td style={tableCellStyle}>{alert.eventName}</td>
                      <td style={tableCellStyle}>{alert.count}</td>
                      <td style={tableCellStyle}>{alert.threshold}</td>
                      <td style={tableCellStyle}>
                        {new Date(alert.firstTriggeredAt).toLocaleString()}
                      </td>
                      <td style={tableCellStyle}>
                        {alert.acknowledgedAt
                          ? new Date(alert.acknowledgedAt).toLocaleString()
                          : "Not acknowledged"}
                      </td>
                      <td style={tableCellStyle}>
                        {alert.acknowledgedAt ? (
                          "Acknowledged"
                        ) : (
                          <button
                            onClick={() => acknowledgeAlert(alert.id)}
                            style={{
                              padding: "6px 10px",
                              borderRadius: "8px",
                              border: "1px solid #c7beb4",
                              background: "#ffffff",
                              cursor: "pointer",
                              fontSize: "12px",
                            }}
                          >
                            Acknowledge Alert
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section style={{ marginTop: "28px" }}>
          <SectionTitle>Callback Requests</SectionTitle>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "8px",
              marginBottom: "12px",
            }}
          >
            {[
              { key: "all", label: "All" },
              { key: "pending", label: "Pending" },
              { key: "ai", label: "AI Handled" },
              { key: "staff", label: "Needs Staff" },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setFilterMode(tab.key as FilterMode)}
                style={{
                  padding: "6px 12px",
                  borderRadius: "999px",
                  border: "1px solid #c7beb4",
                  background: filterMode === tab.key ? "#1b1b1b" : "#ffffff",
                  color: filterMode === tab.key ? "#ffffff" : "#5a524b",
                  cursor: "pointer",
                  fontSize: "13px",
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <input
            type="text"
            placeholder="Search by name or phone"
            value={query}
            onChange={e => setQuery(e.target.value)}
            style={{
              marginBottom: "14px",
              width: "100%",
              maxWidth: "320px",
              borderRadius: "10px",
              border: "1px solid #d9d2c7",
              padding: "8px 12px",
            }}
          />
          {callbacksLoading ? (
            <p style={{ color: "#7b726a" }}>Loading callbacks…</p>
          ) : filteredCallbacks.length === 0 ? (
            <p style={{ color: "#7b726a" }}>No callback requests yet.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ textAlign: "left", background: "#f0ebe4" }}>
                    <th style={tableHeaderStyle}>Name</th>
                    <th style={tableHeaderStyle}>Phone</th>
                    <th style={tableHeaderStyle}>Status</th>
                    <th style={tableHeaderStyle}>AI</th>
                    <th style={tableHeaderStyle}>Staff</th>
                    <th style={tableHeaderStyle}>Summary</th>
                    <th style={tableHeaderStyle}>Created</th>
                    <th style={tableHeaderStyle}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCallbacks.map(cb => (
                    <tr
                      key={cb.id}
                      style={{
                        background: cb.id === recentlyUpdatedId ? "#fff7d6" : "transparent",
                      }}
                    >
                      <td style={tableCellStyle}>{cb.name}</td>
                      <td style={tableCellStyle}>{cb.phone}</td>
                      <td style={tableCellStyle}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span>{cb.status}</span>
                          {demoIds.has(cb.id) && (
                            <span
                              style={{
                                fontSize: "11px",
                                padding: "2px 6px",
                                borderRadius: "999px",
                                background: "#e0e7ff",
                                color: "#4338ca",
                              }}
                            >
                              DEMO
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={tableCellStyle}>
                        {cb.aiHandled ? "AI" : "Not handled"}
                      </td>
                      <td style={tableCellStyle}>
                        {cb.staffFollowupRequired ? "Needs staff" : "None"}
                      </td>
                      <td style={tableCellStyle}>{cb.summary ?? "No summary"}</td>
                      <td style={tableCellStyle}>
                        {new Date(cb.createdAt).toLocaleString()}
                      </td>
                      <td style={tableCellStyle}>
                        {cb.status === "pending" && (
                          <button
                            onClick={() => attemptAiCallback(cb.id)}
                            disabled={loadingId === cb.id}
                            style={{
                              padding: "6px 10px",
                              borderRadius: "8px",
                              border: "1px solid #4338ca",
                              background: "#4338ca",
                              color: "#ffffff",
                              cursor: "pointer",
                              fontSize: "12px",
                              marginRight: "8px",
                            }}
                          >
                            {loadingId === cb.id ? "Calling AI…" : "Attempt AI Callback"}
                          </button>
                        )}
                        {(cb.staffFollowupRequired || cb.status === "needs_staff") && (
                          <button
                            onClick={() => markStaffHandled(cb.id)}
                            style={{
                              padding: "6px 10px",
                              borderRadius: "8px",
                              border: "1px solid #c7beb4",
                              background: "#ffffff",
                              cursor: "pointer",
                              fontSize: "12px",
                            }}
                          >
                            Mark Staff Handled
                          </button>
                        )}
                        {cb.status !== "pending" &&
                          !cb.staffFollowupRequired &&
                          cb.status !== "needs_staff" && "No action"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section style={{ marginTop: "28px" }}>
          <SectionTitle>Active Alerts Snapshot</SectionTitle>
          {metricsLoading && <p style={{ color: "#7b726a" }}>Loading metrics...</p>}
          {metricsError && <p style={{ color: "#a23e3e" }}>{metricsError}</p>}
          {!metricsLoading && !metricsError && (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ textAlign: "left", background: "#f0ebe4" }}>
                    <th style={tableHeaderStyle}>Alert</th>
                    <th style={tableHeaderStyle}>Event</th>
                    <th style={tableHeaderStyle}>Count</th>
                    <th style={tableHeaderStyle}>Threshold</th>
                    <th style={tableHeaderStyle}>Window</th>
                    <th style={tableHeaderStyle}>Triggered</th>
                  </tr>
                </thead>
                <tbody>
                  {(metrics?.activeAlerts || []).length === 0 && (
                    <tr>
                      <td
                        style={{ padding: "14px 10px", color: "#7b726a" }}
                        colSpan={6}
                      >
                        No active alerts at this time.
                      </td>
                    </tr>
                  )}
                  {(metrics?.activeAlerts || []).map((alert) => (
                    <tr key={`${alert.alertType}-${alert.eventName}`}>
                      <td style={tableCellStyle}>{alert.alertType}</td>
                      <td style={tableCellStyle}>{alert.eventName}</td>
                      <td style={tableCellStyle}>{alert.count}</td>
                      <td style={tableCellStyle}>{alert.threshold}</td>
                      <td style={tableCellStyle}>{alert.windowSeconds}s</td>
                      <td style={tableCellStyle}>
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
          <SectionTitle>System Status</SectionTitle>
          {!status ? (
            <p style={{ color: "#7b726a" }}>Status unavailable.</p>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: "12px",
              }}
            >
              <article
                style={{
                  padding: "14px 16px",
                  borderRadius: "14px",
                  background: "#f9f4ee",
                  border: "1px solid #e4dbd0",
                }}
              >
                <p style={{ margin: 0, fontSize: "12px", color: "#7b726a" }}>
                  Alert Engine
                </p>
                <p style={{ margin: "8px 0 0", fontSize: "18px" }}>
                  {status.alertEngineInitialized ? "Initialized" : "Disabled"}
                </p>
              </article>
              <article
                style={{
                  padding: "14px 16px",
                  borderRadius: "14px",
                  background: "#f9f4ee",
                  border: "1px solid #e4dbd0",
                }}
              >
                <p style={{ margin: 0, fontSize: "12px", color: "#7b726a" }}>
                  Active Alerts
                </p>
                <p style={{ margin: "8px 0 0", fontSize: "18px" }}>
                  {status.activeAlertCount}
                </p>
              </article>
              <article
                style={{
                  padding: "14px 16px",
                  borderRadius: "14px",
                  background: "#f9f4ee",
                  border: "1px solid #e4dbd0",
                }}
              >
                <p style={{ margin: 0, fontSize: "12px", color: "#7b726a" }}>
                  Event Forwarder
                </p>
                <p style={{ margin: "8px 0 0", fontSize: "18px" }}>
                  {status.eventForwarderEnabled ? "Enabled" : "Disabled"}
                </p>
              </article>
            </div>
          )}
        </section>

        <section style={{ marginTop: "28px" }}>
          <SectionTitle>Recent Alert Activity</SectionTitle>
          {alertEvents.length === 0 ? (
            <p style={{ color: "#7b726a" }}>No recent alert activity.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ textAlign: "left", background: "#f0ebe4" }}>
                    <th style={tableHeaderStyle}>Event</th>
                    <th style={tableHeaderStyle}>Timestamp</th>
                    <th style={tableHeaderStyle}>Environment</th>
                    <th style={tableHeaderStyle}>Correlation</th>
                  </tr>
                </thead>
                <tbody>
                  {alertEvents.map((event, idx) => (
                    <tr key={`${event.type}-${event.createdAt}-${idx}`}>
                      <td style={tableCellStyle}>{event.type}</td>
                      <td style={tableCellStyle}>
                        {new Date(event.createdAt).toLocaleString()}
                      </td>
                      <td style={tableCellStyle}>
                        {event.payload?.environment || "local"}
                      </td>
                      <td style={tableCellStyle}>
                        {event.payload?.correlationId || "Not available"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section style={{ marginTop: "28px" }}>
          <SectionTitle>Alert Acknowledgement Timeline</SectionTitle>
          {ackTimeline.length === 0 ? (
            <p style={{ color: "#7b726a" }}>No alert acknowledgements yet.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ textAlign: "left", background: "#f0ebe4" }}>
                    <th style={tableHeaderStyle}>Alert</th>
                    <th style={tableHeaderStyle}>Operator</th>
                    <th style={tableHeaderStyle}>Acknowledged At</th>
                  </tr>
                </thead>
                <tbody>
                  {ackTimeline.map((entry, idx) => (
                    <tr key={`${entry.eventName}-${entry.createdAt}-${idx}`}>
                      <td style={tableCellStyle}>
                        {entry.payload?.alertType || "Alert"}
                      </td>
                      <td style={tableCellStyle}>
                        {entry.payload?.operatorName
                          ? `${entry.payload.operatorName}${
                              entry.payload.role ? ` (${entry.payload.role})` : ""
                            }`
                          : "Operator unknown"}
                      </td>
                      <td style={tableCellStyle}>
                        {new Date(entry.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section style={{ marginTop: "28px" }}>
          <SectionTitle>Operator Audit Timeline</SectionTitle>
          {auditEvents.length === 0 ? (
            <p style={{ color: "#7b726a" }}>No recent operator activity.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ textAlign: "left", background: "#f0ebe4" }}>
                    <th style={tableHeaderStyle}>Event</th>
                    <th style={tableHeaderStyle}>Timestamp</th>
                    <th style={tableHeaderStyle}>Environment</th>
                    <th style={tableHeaderStyle}>Correlation</th>
                  </tr>
                </thead>
                <tbody>
                  {auditEvents.map((event, idx) => (
                    <tr key={`${event.type}-${event.createdAt}-${idx}`}>
                      <td style={tableCellStyle}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                          <span>{event.type}</span>
                          <span style={{ fontSize: "12px", color: "#7b726a" }}>
                            {event.payload?.operatorName
                              ? `by ${event.payload.operatorName}${event.payload.role ? ` (${event.payload.role})` : ""}`
                              : "Operator unknown"}
                          </span>
                        </div>
                      </td>
                      <td style={tableCellStyle}>
                        {new Date(event.createdAt).toLocaleString()}
                      </td>
                      <td style={tableCellStyle}>
                        {event.payload?.environment || "local"}
                      </td>
                      <td style={tableCellStyle}>
                        {event.payload?.correlationId || "Not available"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section style={{ marginTop: "28px" }}>
          <SectionTitle>SLA Metrics</SectionTitle>
          {!sla ? (
            <p style={{ color: "#7b726a" }}>SLA data unavailable.</p>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                gap: "12px",
              }}
            >
              <article
                style={{
                  padding: "14px 16px",
                  borderRadius: "14px",
                  background: "#f9f4ee",
                  border: "1px solid #e4dbd0",
                }}
              >
                <p style={{ margin: 0, fontSize: "12px", color: "#7b726a" }}>
                  Callback SLA Avg
                </p>
                <p style={{ margin: "8px 0 0", fontSize: "22px" }}>
                  {sla.callbacks.averageSeconds}s
                </p>
                <p style={{ margin: "6px 0 0", fontSize: "12px", color: "#7b726a" }}>
                  Breaches (&gt;10m): {sla.callbacks.breachCount}
                </p>
              </article>
              <article
                style={{
                  padding: "14px 16px",
                  borderRadius: "14px",
                  background: "#f9f4ee",
                  border: "1px solid #e4dbd0",
                }}
              >
                <p style={{ margin: 0, fontSize: "12px", color: "#7b726a" }}>
                  Alert SLA Avg
                </p>
                <p style={{ margin: "8px 0 0", fontSize: "22px" }}>
                  {sla.alerts.averageSeconds}s
                </p>
                <p style={{ margin: "6px 0 0", fontSize: "12px", color: "#7b726a" }}>
                  Breaches (&gt;10m): {sla.alerts.breachCount}
                </p>
              </article>
              <article
                style={{
                  padding: "14px 16px",
                  borderRadius: "14px",
                  background: "#f9f4ee",
                  border: "1px solid #e4dbd0",
                }}
              >
                <p style={{ margin: 0, fontSize: "12px", color: "#7b726a" }}>
                  Callback Buckets
                </p>
                <p style={{ margin: "8px 0 0", fontSize: "12px" }}>
                  ≤2m {sla.callbacks.buckets.le2m} · ≤5m {sla.callbacks.buckets.le5m}
                </p>
                <p style={{ margin: "6px 0 0", fontSize: "12px" }}>
                  ≤10m {sla.callbacks.buckets.le10m} · &gt;10m {sla.callbacks.buckets.gt10m}
                </p>
              </article>
              <article
                style={{
                  padding: "14px 16px",
                  borderRadius: "14px",
                  background: "#f9f4ee",
                  border: "1px solid #e4dbd0",
                }}
              >
                <p style={{ margin: 0, fontSize: "12px", color: "#7b726a" }}>
                  Alert Buckets
                </p>
                <p style={{ margin: "8px 0 0", fontSize: "12px" }}>
                  ≤2m {sla.alerts.buckets.le2m} · ≤5m {sla.alerts.buckets.le5m}
                </p>
                <p style={{ margin: "6px 0 0", fontSize: "12px" }}>
                  ≤10m {sla.alerts.buckets.le10m} · &gt;10m {sla.alerts.buckets.gt10m}
                </p>
              </article>
            </div>
          )}
        </section>

        <section style={{ marginTop: "28px" }}>
          <SectionTitle>Event Counts</SectionTitle>
          {!metricsLoading && !metricsError && (
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
