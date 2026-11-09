// Pure camera maths for the follow camera (no THREE, so it can be unit tested): the pitch range, the three View presets, how a low view
// aims ahead of the angler so the horizon and sky come into frame, and where the fight camera wants to sit.
import { clamp, lerp, smoothstep } from '../core/noise.js';

/** Pitch is the camera's elevation above the horizon as seen from the angler: 1.45 rad = 83 degrees (near top-down), 0.44 = 25 degrees (low, over the shoulder). */
export const PITCH = { min: 0.44, max: 1.45, diorama: 1.06 };
export const PRESETS = {
  diorama: { label: 'Diorama', pitch: 1.06, zoom: 12.6 },
  low: { label: 'Low', pitch: 0.66, zoom: 11.5 },
  shoulder: { label: 'Over the shoulder', pitch: 0.47, zoom: 8.2, behind: true },
};
/** The view a new game starts in: low enough that the water, the far shore and the sky are in frame (the top-down diorama shows only ground). */
export const DEFAULT_PRESET = 'low';
export const PRESET_ORDER = ['diorama', 'low', 'shoulder'];
export const nextPreset = id => PRESET_ORDER[(PRESET_ORDER.indexOf(id) + 1) % PRESET_ORDER.length] ?? 'diorama';
/** Which preset (if any) a pitch is close to; 'custom' once the player has tilted by hand. */
export function presetNear(pitch, tol = 0.04) { for (const id of PRESET_ORDER) if (Math.abs(PRESETS[id].pitch - pitch) < tol) return id; return 'custom'; }

/** 0 for a high view (pitch >= 0.95), 1 for the lowest (pitch <= 0.5): how much the camera lifts its aim toward the horizon. */
export const lowBlend = pitch => 1 - smoothstep(0.5, 0.95, pitch);
/**
 * Lens and aim for a pitch. A low camera looking straight at the angler would see only ground; it aims `ahead` metres past them, widens the lens
 * and slides the angler to one side (the "shoulder") so the horizon, the sky and the sunset are in frame.
 */
export function viewParams(pitch) {
  const k = lowBlend(pitch);
  return { k, fov: lerp(42, 56, k), ahead: lerp(0, 7.5, k), lift: lerp(0, 0.5, k), side: lerp(0, 4.5, smoothstep(0.6, 0.45, pitch)) };
}

/** The shortest signed angle from a to b. */
export const angleDiff = (a, b) => ((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;

/** Pitch the fight camera eases to: a lower, readable angle, but never higher than the one the player already chose. */
export const FIGHT_PITCH = 0.6;
export const fightPitch = pitch => Math.min(pitch, FIGHT_PITCH);
/**
 * The camera yaw that sees the line side-on (the view direction 65 degrees off the line, whichever side is nearer to where the player's camera already is),
 * as an offset from `yaw`. Camera "forward" on the ground is (-sin yaw, -cos yaw).
 */
export function fightYawOffset(yaw, lineX, lineZ, across = 1.13) {
  if (Math.hypot(lineX, lineZ) < 1e-3) return 0;
  const bearing = Math.atan2(-lineX, -lineZ);                       // the yaw whose forward points along the line (angler to float)
  const a = bearing + across, b = bearing - across;
  const target = Math.abs(angleDiff(yaw, a)) < Math.abs(angleDiff(yaw, b)) ? a : b;
  return clamp(angleDiff(yaw, target), -1.6, 1.6);
}
/** Where the fight camera aims: a bit toward the float and lifted so the angler's head and the rod bend sit above the key bar. */
export function fightFocus(target, float, sep) {
  const k = 0.48;
  return { x: target.x + (float.x - target.x) * k, z: target.z + (float.z - target.z) * k, y: target.y * 0.8 + float.y * 0.2 + 1.0 };
}
