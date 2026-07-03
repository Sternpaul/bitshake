/**
 * Build adaptive SVG gradient stops that create a heat-map effect.
 *
 * The gradient maps to the Y-axis of a Recharts AreaChart:
 *   - Top of chart = dataMax → deep blue if positive (high consumption)
 *   - Zero line    = neutral → nearly transparent, with a faint directional hint
 *   - Bottom       = dataMin → deep orange if negative (high export)
 *
 * Both the fill (shading) and stroke (line) get their own gradient.
 * The stroke stays visible at all times but shifts in intensity.
 *
 * @param {Array} chartData  — Array of data points
 * @param {string} powerKey  — Key to read the power value from (default: 'power')
 * @returns {{ fillStops, strokeStops, zeroOffset }}
 */

const BLUE = 'hsl(210, 100%, 60%)';
const ORANGE = 'hsl(38, 92%, 55%)';

export function buildAdaptiveGradient(chartData, powerKey = 'power') {
  const values = chartData.map(d => d[powerKey] || 0);

  if (values.length === 0) {
    return {
      fillStops: [{ offset: 0, color: BLUE, opacity: 0.1 }, { offset: 1, color: BLUE, opacity: 0.1 }],
      strokeStops: [{ offset: 0, color: BLUE, opacity: 0.5 }, { offset: 1, color: BLUE, opacity: 0.5 }],
      zeroOffset: 0.5,
    };
  }

  const dataMax = Math.max(...values);
  const dataMin = Math.min(...values);

  // Opacity tuning — "between subtle and bold"
  const MAX_FILL = 0.35;
  const MIN_FILL = 0.04;     // near-zero: barely visible but hints at direction
  const MAX_STROKE = 1.0;
  const MIN_STROKE = 0.4;    // line near zero: muted but clearly visible

  // Where zero sits in the gradient (0 = top of chart, 1 = bottom)
  let zeroOffset;
  if (dataMax <= 0) zeroOffset = 0;
  else if (dataMin >= 0) zeroOffset = 1;
  else zeroOffset = dataMax / (dataMax - dataMin);

  const fillStops = [];
  const strokeStops = [];

  const lerp = (a, b, t) => a + (b - a) * t;

  // Non-linear distribution of stops — denser near zero for a smoother transition
  const STEPS = [0, 0.15, 0.35, 0.55, 0.75, 0.90, 1.0];

  if (zeroOffset > 0) {
    // ── Blue zone: top (dataMax) → zero line ──
    // step=0 is at the extreme (deep), step=1 is at zero (faint)
    for (const step of STEPS) {
      const distFromZero = 1 - step; // 1 at extreme, 0 at zero
      fillStops.push({
        offset: step * zeroOffset,
        color: BLUE,
        opacity: lerp(MIN_FILL, MAX_FILL, distFromZero),
      });
      strokeStops.push({
        offset: step * zeroOffset,
        color: BLUE,
        opacity: lerp(MIN_STROKE, MAX_STROKE, distFromZero),
      });
    }
  }

  if (zeroOffset < 1) {
    // ── Orange zone: zero line → bottom (dataMin) ──
    // step=0 is at zero (faint), step=1 is at the extreme (deep)
    for (const step of STEPS) {
      const distFromZero = step; // 0 at zero, 1 at extreme
      fillStops.push({
        offset: zeroOffset + step * (1 - zeroOffset),
        color: ORANGE,
        opacity: lerp(MIN_FILL, MAX_FILL, distFromZero),
      });
      strokeStops.push({
        offset: zeroOffset + step * (1 - zeroOffset),
        color: ORANGE,
        opacity: lerp(MIN_STROKE, MAX_STROKE, distFromZero),
      });
    }
  }

  return { fillStops, strokeStops, zeroOffset };
}
