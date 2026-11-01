// Small JPEG thumbnail of the WebGL canvas for field-guide entries (call right after rendering).
export function snapshot(canvas, w = 360) {
  const h = Math.round(w * 10 / 16);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  const sw = canvas.width * 0.76, sh = sw * 10 / 16;
  g.drawImage(canvas, (canvas.width - sw) / 2, (canvas.height - sh) / 2, sw, sh, 0, 0, w, h);
  try { return c.toDataURL('image/jpeg', 0.72); } catch { return null; }
}
