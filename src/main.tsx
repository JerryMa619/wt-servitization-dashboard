import React, { lazy, Suspense } from "react";
import ReactDOM from "react-dom/client";
import "reactflow/dist/style.css";
import "leaflet/dist/leaflet.css";
import "./styles.css";
import App from "./App";
const CmapssApp = lazy(() => import("./cmapss/CmapssApp"));

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {window.location.pathname.split("/").includes("cmapss") ? <Suspense fallback={<p>Loading C-MAPSS replay…</p>}><CmapssApp /></Suspense> : <App />}
  </React.StrictMode>
);
