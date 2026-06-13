export interface DonutSegment {
  value: number;
  /** stroke-dashoffset to position this segment (negative cumulative). */
  offset: number;
  /** stroke length of this segment along the ring. */
  length: number;
}

/**
 * Computes stroke-dasharray segments for a donut chart. Each segment is drawn
 * as a full circle with `strokeDasharray={`${length} ${circumference - length}`}`
 * and `strokeDashoffset={offset}`. Segments are laid head-to-tail around the
 * ring. Returns zero-length segments when the total is 0.
 */
export function donutSegments(
  values: number[],
  circumference: number
): DonutSegment[] {
  const total = values.reduce((a, b) => a + b, 0);
  let cumulative = 0;
  return values.map((value) => {
    const fraction = total > 0 ? value / total : 0;
    const length = fraction * circumference;
    const segment: DonutSegment = { value, offset: -cumulative, length };
    cumulative += length;
    return segment;
  });
}
