// TideLine audio: one object the game talks to. engine.js = Web Audio plumbing, sounds.js = recipes,
// soundscape.js = ambience + animal voices driven by the game state each frame.
import { SoundEngine } from './engine.js';
import { Soundscape } from './soundscape.js';
import { Music } from './music.js';

export class Audio {
  constructor() {
    this.engine = new SoundEngine();
    this.scape = new Soundscape(this.engine);
    this.music = new Music(this.engine);
    this.eco = null;
  }
  get volume() { return this.engine.volume; }
  set volume(v) { this.engine.volume = v; }
  get stats() { return this.engine.stats; }
  /** Must be called from a user gesture (browsers block audio until then). Safe to call repeatedly. */
  start() {
    const fresh = !this.engine.started;
    if (!this.engine.start()) return;
    if (fresh) { this.scape.init(); this.scape.setSite(this.eco); }
    this.music.start();   // first gesture: only now is the first track fetched
  }
  setSite(eco) { this.eco = eco; this.scape.setSite(eco); }
  setVolume(v) { this.engine.setVolume(v); }
  play(name, opts) { return this.engine.play(name, opts); }
  duck(level, time) { this.engine.duck(level, time); }
  /** Every frame: g = { mode, depth, camera, roar, life, eco, reefHealth }. */
  update(dt, g) {
    this.music.plan(g);
    if (!this.engine.ctx) return;
    this.music.update(dt);
    this.engine.setListener(g.camera, g.depth > 0 ? 'water' : 'air');
    this.scape.update(dt, g);
  }
}
