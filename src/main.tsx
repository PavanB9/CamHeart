import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

// NOTE: intentionally not wrapping in <StrictMode>. This is a real-time,
// hardware-bound app (webcam + MediaPipe + a single rAF analysis loop); the
// dev-only double-mount StrictMode performs would double-initialise the camera
// and model. Effects are still written with proper cleanup.
createRoot(document.getElementById('root')!).render(<App />);
