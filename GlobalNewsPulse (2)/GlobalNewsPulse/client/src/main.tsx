import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Declare a global flag to disable automatic fetching behaviors
// This is used in the home page to prevent any automatic API calls
declare global {
  interface Window {
    _disableAllAutoFetching?: boolean;
  }
}

// Initialize with auto-fetching disabled
window._disableAllAutoFetching = true;

createRoot(document.getElementById("root")!).render(<App />);
