import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { KimiProvider } from "./lib/KimiContext.jsx";
import "./index.css";
import "./components/kuden-kimi-widget.js";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <KimiProvider>
      <App />
    </KimiProvider>
  </React.StrictMode>
);
