/**
 * Build adaptive SVG gradient stops that create a heat-map effect.
 *
 * Color progression:
 *   Consumption (positive):  faint sky blue → electric blue → indigo/purple
 *   Export (negative):       faint amber → warm orange → bright gold
 *
 * Both the fill (shading) and stroke (line) get their own gradient.
 * Accepts a `isDark` flag to boost opacity for light mode.
 *
 * @param {Array} chartData  — Array of data points
 * @param {string} powerKey  — Key to read the power value from (default: 'power')
 * @param {object} options   — { isDark: boolean }
 * @returns {{ fillStops, strokeStops, zeroOffset }}
 */

// ── Color ramps (dark mode) — hue shifts at extremes ──
const BLUE_RAMP_DARK = [
  { at: 0,    color: 'hsl(210, 70%, 72%)'  },   // faint sky blue (near zero)
  { at: 0.25, color: 'hsl(210, 100%, 60%)' },   // standard electric blue
  { at: 0.55, color: 'hsl(225, 90%, 56%)'  },   // deeper blue
  { at: 0.80, color: 'hsl(245, 80%, 58%)'  },   // indigo
  { at: 1.0,  color: 'hsl(260, 75%, 55%)'  },   // purple (extreme consumption)
];

const ORANGE_RAMP_DARK = [
  { at: 0,    color: 'hsl(38, 70%, 65%)'   },   // faint amber (near zero)
  { at: 0.25, color: 'hsl(38, 92%, 55%)'   },   // standard warm orange
  { at: 0.55, color: 'hsl(43, 95%, 52%)'   },   // brighter amber
  { at: 0.80, color: 'hsl(48, 96%, 50%)'   },   // gold
  { at: 1.0,  color: 'hsl(52, 97%, 50%)'   },   // bright gold (extreme export)
];

// ── Color ramps (light mode) — deeper/more saturated to stand out on white ──
const BLUE_RAMP_LIGHT = [
  { at: 0,    color: 'hsl(210, 80%, 60%)'  },   // soft blue (near zero)
  { at: 0.25, color: 'hsl(210, 100%, 50%)' },   // vivid blue
  { at: 0.55, color: 'hsl(225, 90%, 45%)'  },   // rich blue
  { at: 0.80, color: 'hsl(245, 80%, 45%)'  },   // deep indigo
  { at: 1.0,  color: 'hsl(260, 75%, 42%)'  },   // dark purple (extreme)
];

const ORANGE_RAMP_LIGHT = [
  { at: 0,    color: 'hsl(30, 80%, 55%)'   },   // warm amber (near zero)
  { at: 0.25, color: 'hsl(30, 95%, 45%)'   },   // deep orange
  { at: 0.55, color: 'hsl(35, 95%, 42%)'   },   // rich amber
  { at: 0.80, color: 'hsl(38, 96%, 40%)'   },   // burnished gold
  { at: 1.0,  color: 'hsl(25, 90%, 38%)'   },   // dark copper (extreme)
];

// ── Opacity ramps ──
const FILL_OPACITY_DARK = [
  { at: 0,    opacity: 0.03 },
  { at: 0.20, opacity: 0.12 },
  { at: 0.45, opacity: 0.28 },
  { at: 0.70, opacity: 0.42 },
  { at: 0.90, opacity: 0.52 },
  { at: 1.0,  opacity: 0.58 },
];

const FILL_OPACITY_LIGHT = [
  { at: 0,    opacity: 0.06 },   // slightly more visible at near-zero
  { at: 0.20, opacity: 0.18 },
  { at: 0.45, opacity: 0.35 },
  { at: 0.70, opacity: 0.50 },
  { at: 0.90, opacity: 0.62 },
  { at: 1.0,  opacity: 0.70 },   // much richer at extremes
];

const STROKE_OPACITY_DARK = [
  { at: 0,    opacity: 0.35 },
  { at: 0.25, opacity: 0.55 },
  { at: 0.50, opacity: 0.75 },
  { at: 0.75, opacity: 0.90 },
  { at: 1.0,  opacity: 1.0  },
];

const STROKE_OPACITY_LIGHT = [
  { at: 0,    opacity: 0.45 },   // more visible near zero
  { at: 0.25, opacity: 0.65 },
  { at: 0.50, opacity: 0.80 },
  { at: 0.75, opacity: 0.92 },
  { at: 1.0,  opacity: 1.0  },
];

function interpolateRamp(ramp, t) {
  t = Math.max(0, Math.min(1, t));

  for (let i = 0; i < ramp.length - 1; i++) {
    if (t >= ramp[i].at && t <= ramp[i + 1].at) {
      const localT = (t - ramp[i].at) / (ramp[i + 1].at - ramp[i].at);

      if ('color' in ramp[i]) {
        return ramp[localT < 0.5 ? i : i + 1].color;
      }
      if ('opacity' in ramp[i]) {
        return ramp[i].opacity + (ramp[i + 1].opacity - ramp[i].opacity) * localT;
      }
    }
  }

  return ramp[ramp.length - 1].color || ramp[ramp.length - 1].opacity;
}

export function buildAdaptiveGradient(chartData, powerKey = 'power', options = {}) {
  const { isDark = true } = options;
  const values = chartData.map(d => d[powerKey] || 0);

  // Pick ramps based on theme
  const blueRamp = isDark ? BLUE_RAMP_DARK : BLUE_RAMP_LIGHT;
  const orangeRamp = isDark ? ORANGE_RAMP_DARK : ORANGE_RAMP_LIGHT;
  const fillOpacityRamp = isDark ? FILL_OPACITY_DARK : FILL_OPACITY_LIGHT;
  const strokeOpacityRamp = isDark ? STROKE_OPACITY_DARK : STROKE_OPACITY_LIGHT;

  if (values.length === 0) {
    return {
      fillStops: [
        { offset: 0, color: blueRamp[1].color, opacity: 0.08 },
        { offset: 1, color: blueRamp[1].color, opacity: 0.08 },
      ],
      strokeStops: [
        { offset: 0, color: blueRamp[1].color, opacity: 0.5 },
        { offset: 1, color: blueRamp[1].color, opacity: 0.5 },
      ],
      zeroOffset: 0.5,
    };
  }

  const dataMax = Math.max(...values);
  const dataMin = Math.min(...values);

  let zeroOffset;
  if (dataMax <= 0) zeroOffset = 0;
  else if (dataMin >= 0) zeroOffset = 1;
  else zeroOffset = dataMax / (dataMax - dataMin);

  const fillStops = [];
  const strokeStops = [];
  const NUM_STOPS = 10;

  if (zeroOffset > 0) {
    for (let i = 0; i <= NUM_STOPS; i++) {
      const step = i / NUM_STOPS;
      const intensity = 1 - step;
      const offset = step * zeroOffset;

      fillStops.push({
        offset,
        color: interpolateRamp(blueRamp, intensity),
        opacity: interpolateRamp(fillOpacityRamp, intensity),
      });
      strokeStops.push({
        offset,
        color: interpolateRamp(blueRamp, intensity),
        opacity: interpolateRamp(strokeOpacityRamp, intensity),
      });
    }
  }

  if (zeroOffset < 1) {
    for (let i = 0; i <= NUM_STOPS; i++) {
      const step = i / NUM_STOPS;
      const intensity = step;
      const offset = zeroOffset + step * (1 - zeroOffset);

      fillStops.push({
        offset,
        color: interpolateRamp(orangeRamp, intensity),
        opacity: interpolateRamp(fillOpacityRamp, intensity),
      });
      strokeStops.push({
        offset,
        color: interpolateRamp(orangeRamp, intensity),
        opacity: interpolateRamp(strokeOpacityRamp, intensity),
      });
    }
  }

  return { fillStops, strokeStops, zeroOffset };
}
