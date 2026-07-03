/**
 * Build adaptive SVG gradient stops that create a heat-map effect.
 *
 * Color progression:
 *   Consumption (positive):  faint sky blue → electric blue → indigo/purple
 *   Export (negative):       faint amber → warm orange → bright gold
 *
 * Both the fill (shading) and stroke (line) get their own gradient.
 *
 * @param {Array} chartData  — Array of data points
 * @param {string} powerKey  — Key to read the power value from (default: 'power')
 * @returns {{ fillStops, strokeStops, zeroOffset }}
 */

// Color ramps — hue shifts at extremes for visual punch
const BLUE_RAMP = [
  { at: 0,    color: 'hsl(210, 70%, 72%)'  },   // faint sky blue (near zero)
  { at: 0.25, color: 'hsl(210, 100%, 60%)' },   // standard electric blue
  { at: 0.55, color: 'hsl(225, 90%, 56%)'  },   // deeper blue
  { at: 0.80, color: 'hsl(245, 80%, 58%)'  },   // indigo
  { at: 1.0,  color: 'hsl(260, 75%, 55%)'  },   // purple (extreme consumption)
];

const ORANGE_RAMP = [
  { at: 0,    color: 'hsl(38, 70%, 65%)'   },   // faint amber (near zero)
  { at: 0.25, color: 'hsl(38, 92%, 55%)'   },   // standard warm orange
  { at: 0.55, color: 'hsl(43, 95%, 52%)'   },   // brighter amber
  { at: 0.80, color: 'hsl(48, 96%, 50%)'   },   // gold
  { at: 1.0,  color: 'hsl(52, 97%, 50%)'   },   // bright gold (extreme export)
];

// Opacity ramps
const FILL_OPACITY_RAMP = [
  { at: 0,    opacity: 0.03 },   // near zero: barely visible hint
  { at: 0.20, opacity: 0.12 },
  { at: 0.45, opacity: 0.28 },
  { at: 0.70, opacity: 0.42 },
  { at: 0.90, opacity: 0.52 },
  { at: 1.0,  opacity: 0.58 },   // extreme: rich and saturated
];

const STROKE_OPACITY_RAMP = [
  { at: 0,    opacity: 0.35 },   // near zero: muted but visible
  { at: 0.25, opacity: 0.55 },
  { at: 0.50, opacity: 0.75 },
  { at: 0.75, opacity: 0.90 },
  { at: 1.0,  opacity: 1.0  },   // extreme: solid vivid line
];

function interpolateRamp(ramp, t) {
  // Clamp t to [0, 1]
  t = Math.max(0, Math.min(1, t));

  // Find the two surrounding stops
  for (let i = 0; i < ramp.length - 1; i++) {
    if (t >= ramp[i].at && t <= ramp[i + 1].at) {
      const localT = (t - ramp[i].at) / (ramp[i + 1].at - ramp[i].at);

      // Return color or opacity depending on what the ramp contains
      if ('color' in ramp[i]) {
        // For colors: just pick the nearest — SVG will interpolate between stops
        return ramp[localT < 0.5 ? i : i + 1].color;
      }
      if ('opacity' in ramp[i]) {
        return ramp[i].opacity + (ramp[i + 1].opacity - ramp[i].opacity) * localT;
      }
    }
  }

  // Fallback to last stop
  return ramp[ramp.length - 1].color || ramp[ramp.length - 1].opacity;
}

export function buildAdaptiveGradient(chartData, powerKey = 'power') {
  const values = chartData.map(d => d[powerKey] || 0);

  if (values.length === 0) {
    return {
      fillStops: [
        { offset: 0, color: 'hsl(210, 100%, 60%)', opacity: 0.08 },
        { offset: 1, color: 'hsl(210, 100%, 60%)', opacity: 0.08 },
      ],
      strokeStops: [
        { offset: 0, color: 'hsl(210, 100%, 60%)', opacity: 0.5 },
        { offset: 1, color: 'hsl(210, 100%, 60%)', opacity: 0.5 },
      ],
      zeroOffset: 0.5,
    };
  }

  const dataMax = Math.max(...values);
  const dataMin = Math.min(...values);

  // Where zero sits in the gradient (0 = top of chart, 1 = bottom)
  let zeroOffset;
  if (dataMax <= 0) zeroOffset = 0;
  else if (dataMin >= 0) zeroOffset = 1;
  else zeroOffset = dataMax / (dataMax - dataMin);

  const fillStops = [];
  const strokeStops = [];

  // Number of gradient stops per zone — more stops = smoother gradient
  const NUM_STOPS = 10;

  if (zeroOffset > 0) {
    // ── Blue zone: top (dataMax, extreme) → zero line (neutral) ──
    for (let i = 0; i <= NUM_STOPS; i++) {
      const step = i / NUM_STOPS;                // 0 = top (extreme), 1 = zero
      const intensity = 1 - step;                // 1 at extreme, 0 at zero
      const offset = step * zeroOffset;

      fillStops.push({
        offset,
        color: interpolateRamp(BLUE_RAMP, intensity),
        opacity: interpolateRamp(FILL_OPACITY_RAMP, intensity),
      });
      strokeStops.push({
        offset,
        color: interpolateRamp(BLUE_RAMP, intensity),
        opacity: interpolateRamp(STROKE_OPACITY_RAMP, intensity),
      });
    }
  }

  if (zeroOffset < 1) {
    // ── Orange zone: zero line (neutral) → bottom (dataMin, extreme) ──
    for (let i = 0; i <= NUM_STOPS; i++) {
      const step = i / NUM_STOPS;                // 0 = zero, 1 = bottom (extreme)
      const intensity = step;                    // 0 at zero, 1 at extreme
      const offset = zeroOffset + step * (1 - zeroOffset);

      fillStops.push({
        offset,
        color: interpolateRamp(ORANGE_RAMP, intensity),
        opacity: interpolateRamp(FILL_OPACITY_RAMP, intensity),
      });
      strokeStops.push({
        offset,
        color: interpolateRamp(ORANGE_RAMP, intensity),
        opacity: interpolateRamp(STROKE_OPACITY_RAMP, intensity),
      });
    }
  }

  return { fillStops, strokeStops, zeroOffset };
}
