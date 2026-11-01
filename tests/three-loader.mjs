const root = new URL('../vendor/three/', import.meta.url);
export async function resolve(spec, ctx, next) {
  if (spec === 'three') return { url: new URL('build/three.module.js', root).href, shortCircuit: true };
  if (spec.startsWith('three/examples/jsm/')) return { url: new URL(spec.slice('three/'.length), root).href, shortCircuit: true };
  return next(spec, ctx);
}
