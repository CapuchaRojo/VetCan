import { BrowserRouter, Route, Routes } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import MetricsDashboard from "./pages/MetricsDashboard";

export default function App() {
  return (
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/metrics" element={<MetricsDashboard />} />
      </Routes>
    </BrowserRouter>
  );
}
