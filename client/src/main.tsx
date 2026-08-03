import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { installErrorReporter } from "./lib/errorReporter";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";

installErrorReporter();

createRoot(document.getElementById("root")!).render(
  <AppErrorBoundary>
    <App />
  </AppErrorBoundary>,
);
