import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

// Loads the MediaPipe FaceLandmarker from the LOCALLY-VENDORED assets in
// /public/models (see scripts/fetch-models.mjs) so the app runs fully offline.
// A single shared instance is reused across mode switches.

let instance: FaceLandmarker | null = null;
let loading: Promise<FaceLandmarker> | null = null;

async function create(delegate: 'GPU' | 'CPU'): Promise<FaceLandmarker> {
  // BASE_URL is '/' in dev and '/CamHeart/' in the Pages build, so the vendored
  // assets resolve correctly in both.
  const base = import.meta.env.BASE_URL;
  const fileset = await FilesetResolver.forVisionTasks(`${base}models/wasm`);
  return FaceLandmarker.createFromOptions(fileset, {
    baseOptions: {
      modelAssetPath: `${base}models/face_landmarker.task`,
      delegate,
    },
    runningMode: 'VIDEO',
    numFaces: 1,
    minFaceDetectionConfidence: 0.5,
    minFacePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });
}

/** Get (or lazily create) the shared FaceLandmarker. Falls back GPU → CPU. */
export function getFaceLandmarker(): Promise<FaceLandmarker> {
  if (instance) return Promise.resolve(instance);
  if (!loading) {
    loading = create('GPU')
      .catch(() => create('CPU'))
      .then((fl) => {
        instance = fl;
        return fl;
      });
  }
  return loading;
}
