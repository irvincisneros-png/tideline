// Map the browser import map ('three' -> vendored build) for Node test runs.
import { register } from 'node:module';
register('./three-loader.mjs', import.meta.url);
