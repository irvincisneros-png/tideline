// Site registry. Each entry is a full site definition (see rocky.js for the shape; seagrass.js is the estuary).
// To add a site: write src/ecosystems/<id>.js exporting it, import it here and add it to ECOSYSTEMS.
import { rocky } from './rocky.js';
import { seagrass } from './seagrass.js';
import { harbour } from './harbour.js';

export const ECOSYSTEMS = [rocky, seagrass, harbour];
export const ecoById = id => ECOSYSTEMS.find(e => e.id === id);
