// Brag-mat geometry (pure, no DOM): where the picture of the fish sits on the mat's cm scale.
// NSW measures TOTAL length: snout tip (mouth closed) to the tail tip. The fish picture is framed on the model's bounding box, whose x extent is exactly
// the model's total length (buildFish remaps x to -L/2 .. +L/2), so drawing the picture lenCm wide with its left edge on the 0 stop puts the snout tip at 0 cm and the tail tip at lenCm.
/** Pixel box of the fish picture. padL = px of the 0 stop, pxcm = px per cm, aspect = image height / width. */
export function matFishBox(lenCm, pxcm, aspect, padL) {
  const width = lenCm * pxcm;
  return { left: padL, width, height: width * aspect, snoutX: padL, tailX: padL + width };
}
/** Which cm marks the snout and the tail tip fall on (for the unit test and sanity checks). */
export function matReading(box, padL, pxcm) { return { snoutCm: (box.snoutX - padL) / pxcm, tailCm: (box.tailX - padL) / pxcm }; }
