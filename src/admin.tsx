import React from "react";
import ReactDOM from "react-dom/client";
import { AdminView } from "./components/AdminView";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AdminView />
  </React.StrictMode>
);
