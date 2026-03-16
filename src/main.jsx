import React from "react";
import ReactDOM from "react-dom/client";
import SpeakersGymTracker from "../tracker.jsx";
import OnlineApp from "./OnlineApp.jsx";

// Route: ?student=CODE → student view, ?coach → coach portal
// Default (no params) → original offline tracker
const params = new URLSearchParams(window.location.search);
const isOnline = params.has("coach") || params.has("student");

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {isOnline ? <OnlineApp /> : <SpeakersGymTracker />}
  </React.StrictMode>
);
