/**
 * Opens the device's file picker (web). On phones `accept="video/*"` offers
 * the gallery and the camera. Resolves null if nothing was chosen.
 */
export function pickFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') return resolve(null);
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.style.display = 'none';
    input.addEventListener('change', () => {
      resolve(input.files?.[0] ?? null);
      input.remove();
    });
    // Closing the picker without choosing: no change event in every browser,
    // so the promise may stay pending — callers don't hold a busy state before a file arrives.
    document.body.appendChild(input);
    input.click();
  });
}
