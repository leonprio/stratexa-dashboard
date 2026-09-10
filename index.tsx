import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { ContinuityEngineHarness } from "./components/ContinuityEngineHarness";

import { ErrorBoundary } from "./components/ErrorBoundary";

const container = document.getElementById("root");

if (!container) {
  throw new Error("No se encontró el elemento #root en index.html");
}

if (import.meta.env.DEV && ["/__continuity-engine-harness", "/__pending-harness"].includes(window.location.pathname)) {
  createRoot(container).render(<ContinuityEngineHarness />);
} else createRoot(container).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
