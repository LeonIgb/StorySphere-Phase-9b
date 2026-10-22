// Media upload service (audio and video), the swap point for a real upload backend.
//
// =========================================================================================
// PROTOTYPE. "Uploading" here validates the file, copies it into this app's storage and shows
// progress; NOTHING IS SENT TO A SERVER. The file stays on this device, so a story with uploaded
// media only plays on this device. The progress bar is a timed simulation, not a network measure.
// =========================================================================================
//
// What a real backend does instead (keep this interface, replace the body of `upload`):
//   1. POST /media/uploads { kind, name, size, mimeType }  -> the server checks type and size limits
//      again and returns { uploadId, signedUrl } (limits are never enforced by the client alone).
//   2. PUT the file to signedUrl in chunks (resumable), reporting real bytes sent to onProgress.
//   3. The server scans the file, transcodes video to streaming formats (HLS/MP4) and audio to AAC,
//      extracts the duration and a poster frame, and returns { mediaId, url, durationMs }.
//   4. The story stores mediaId/url, not a device path, so it plays on every device.
// Deleting a story or a media block should also delete the stored object.
import { persistFile } from '../utils/mediaStore';
import { simulatedUploadMs, validateMediaFile } from '../utils/mediaFiles';

let failNext = false;

export const mediaProvider = {
  // DEMO control (Profile > Developer tools): make the next upload fail so the error state can be seen.
  setFailNext(value) {
    failNext = Boolean(value);
  },
  getFailNext: () => failNext,

  // Validates and "uploads" one picked file.
  //   kind: 'video' | 'audio'
  //   asset: { uri, name, size, mimeType, duration } from a picker
  //   onProgress(fraction 0..1), onStage('checking' | 'uploading' | 'saving')
  // Returns { cancel(), promise } where promise resolves to { ok, file, persisted, error }.
  upload(kind, asset, { onProgress, onStage } = {}) {
    let cancelled = false;
    let timer = null;
    let finish = null;
    const promise = new Promise((resolve) => {
      finish = resolve;
      const checked = validateMediaFile(kind, asset);
      if (!checked.ok) {
        resolve({ ok: false, error: checked.error });
        return;
      }
      if (onStage) onStage('uploading');
      const total = simulatedUploadMs(checked.file.size);
      const started = Date.now();
      const failAt = failNext ? 0.6 : null;
      failNext = false;
      const tick = async () => {
        if (cancelled) return;
        const fraction = Math.min(1, (Date.now() - started) / total);
        if (failAt !== null && fraction >= failAt) {
          resolve({ ok: false, error: 'The upload failed (simulated). Check your connection and try again.' });
          return;
        }
        if (onProgress) onProgress(fraction);
        if (fraction < 1) {
          timer = setTimeout(tick, 80);
          return;
        }
        if (onStage) onStage('saving');
        const stored = await persistFile(checked.file.uri, checked.file.name);
        if (cancelled) return;
        resolve({ ok: true, file: { ...checked.file, uri: stored.uri }, persisted: stored.persisted });
      };
      timer = setTimeout(tick, 80);
    });
    return {
      promise,
      cancel() {
        cancelled = true;
        if (timer) clearTimeout(timer);
        if (finish) finish({ ok: false, cancelled: true, error: 'Upload cancelled.' });
      },
    };
  },
};
