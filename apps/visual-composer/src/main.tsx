import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@xyflow/react/dist/style.css";
import "./styles.css";
import { App } from "./App.js";

const root = document.querySelector<HTMLDivElement>("#root");
if (root === null) throw new Error("IRIS composer root is missing.");
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
