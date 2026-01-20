import { BrowserRouter, Route, Routes } from "react-router-dom";
import MetricsDashboard from "./pages/MetricsDashboard";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MetricsDashboard />} />
        <Route path="/metrics" element={<MetricsDashboard />} />
      </Routes>
    </BrowserRouter>
  );
}
