import React from "react";
import YogaPoseDetector from "./YogaPoseDetector";

function App() {
  return (
    <div className="app">
      <header>
        <h1>Yoga Pose Detector</h1>
        <p>Frontend sends MediaPipe keypoints to Flask backend via Axios.</p>
      </header>

      <main>
        <YogaPoseDetector />
      </main>

      <footer>
        <small>Set API URL in <code>REACT_APP_API_URL</code> (defaults to http://localhost:5000)</small>
      </footer>
    </div>
  );
}

export default App;
