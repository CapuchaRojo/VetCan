import { BrowserRouter, Route, Routes } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import MetricsDashboard from "./pages/MetricsDashboard";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/metrics" element={<MetricsDashboard />} />
      </Routes>
    </BrowserRouter>
  );
}
