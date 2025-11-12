import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import { Pose } from "@mediapipe/pose";
import * as cam from "@mediapipe/camera_utils";

const POSE_OPTIONS = [
  "adho mukha svanasana",
  "balasana",
  "garudasana",
  "marjaryasana",
  "parsva bakasana",
  "salabhasana",
  "setu bandha sarvangasana",
  "utthita trikonasana",
  "virabhadrasana ii",
];

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:5000";

export default function YogaPoseDetector() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const cameraRef = useRef(null);
  const [selectedPose, setSelectedPose] = useState(POSE_OPTIONS[0]);
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    let pose;
    async function setup() {
      if (!videoRef.current) return;

      pose = new Pose({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
      });

      pose.setOptions({
        modelComplexity: 1,
        smoothLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });

      pose.onResults(onResults);

      cameraRef.current = new cam.Camera(videoRef.current, {
        onFrame: async () => {
          await pose.send({ image: videoRef.current });
        },
        width: 640,
        height: 480,
      });
    }

    setup();

    return () => {
      // cleanup on unmount
      try {
        if (cameraRef.current && cameraRef.current.stop) cameraRef.current.stop();
      } catch (err) {}
      if (pose && pose.close) pose.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startCamera() {
    setPrediction(null);
    setError(null);
    setIsRunning(true);
    if (cameraRef.current && cameraRef.current.start) cameraRef.current.start();
  }

  function stopCamera() {
    setIsRunning(false);
    if (cameraRef.current && cameraRef.current.stop) cameraRef.current.stop();
  }

  // Draw keypoints to canvas overlay
  function drawLandmarks(landmarks) {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;
    const ctx = canvas.getContext("2d");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!landmarks) return;

    // draw connections lightly
    ctx.lineWidth = 2;
    for (let i = 0; i < landmarks.length; i++) {
      const x = landmarks[i].x * canvas.width;
      const y = landmarks[i].y * canvas.height;
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, 2 * Math.PI);
      ctx.fillStyle = "rgba(0,255,0,0.9)";
      ctx.fill();
      ctx.closePath();
    }
  }

  // Called by MediaPipe on each processed frame
  async function onResults(results) {
    if (!results) return;
    drawLandmarks(results.poseLandmarks);

    // send only occasional frames to reduce calls (e.g., every frame here; you may throttle)
    if (!results.poseLandmarks) return;

    const keypoints = results.poseLandmarks.map((kp) => ({
      x: kp.x,
      y: kp.y,
      z: kp.z ?? 0,
      visibility: kp.visibility ?? 0,
    }));

    // POST to backend
    setLoading(true);
    setError(null);

    try {
      const resp = await axios.post(`${API_BASE}/predict`, {
        keypoints,
        selected_pose: selectedPose,
      }, {
        timeout: 5000
      });

      setPrediction(resp.data);
    } catch (err) {
      setError("Prediction failed. Check backend or CORS.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="detector">
      <div className="controls">
        <label>
          Select expected pose:
          <select value={selectedPose} onChange={(e) => setSelectedPose(e.target.value)}>
            {POSE_OPTIONS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>

        <div className="buttons">
          {!isRunning ? (
            <button onClick={startCamera} className="btn primary">Start Camera</button>
          ) : (
            <button onClick={stopCamera} className="btn">Stop Camera</button>
          )}
        </div>
      </div>

      <div className="video-area">
        <video ref={videoRef} id="video" className="video" autoPlay playsInline muted />
        <canvas ref={canvasRef} className="overlay" />
      </div>

      <div className="status">
        {loading && <p>Processing...</p>}
        {error && <p className="error">{error}</p>}

        {prediction && (
          <div className="result">
            <h3>Predicted Pose: {prediction.predicted_pose}</h3>
            {prediction.selected_pose && <p>Selected Pose: {prediction.selected_pose}</p>}
            <h4>Angles</h4>
            <pre className="angles">{JSON.stringify(prediction.angles, null, 2)}</pre>
            {prediction.score && <p>Score: {prediction.score}</p>}
            {prediction.incorrect_parts && prediction.incorrect_parts.length > 0 && (
              <div>
                <h4>Incorrect Parts</h4>
                <ul>
                  {prediction.incorrect_parts.map((p, idx) => (
                    <li key={idx}>{p}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
