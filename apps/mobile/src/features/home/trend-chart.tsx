import { useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';
import { colors } from '@/constants/theme';

/*
 * A smooth line with a soft fill under it, the way trading apps draw a day: no axes, no grid,
 * just the shape of the numbers and a dot on today. Sizes itself to its container.
 */

type Point = { x: number; y: number };

/** Monotone cubic interpolation: smooth, but never dips below or rises above the data it joins. */
function smoothPath(points: Point[]) {
  const n = points.length;
  if (!n) return '';
  if (n < 3)
    return (
      `M ${points[0].x} ${points[0].y}` +
      points
        .slice(1)
        .map((p) => ` L ${p.x} ${p.y}`)
        .join('')
    );
  const sign = (value: number) => (value < 0 ? -1 : value > 0 ? 1 : 0);
  const slopes: number[] = [];
  for (let i = 1; i < n - 1; i++) {
    const h0 = points[i].x - points[i - 1].x;
    const h1 = points[i + 1].x - points[i].x;
    const s0 = (points[i].y - points[i - 1].y) / (h0 || 1);
    const s1 = (points[i + 1].y - points[i].y) / (h1 || 1);
    const p = (s0 * h1 + s1 * h0) / (h0 + h1);
    slopes[i] = (sign(s0) + sign(s1)) * Math.min(Math.abs(s0), Math.abs(s1), 0.5 * Math.abs(p)) || 0;
  }
  const edge = (a: Point, b: Point, t: number) => {
    const h = b.x - a.x;
    return h ? (3 * (b.y - a.y)) / h / 2 - t / 2 : t;
  };
  slopes[0] = edge(points[0], points[1], slopes[1]);
  slopes[n - 1] = edge(points[n - 2], points[n - 1], slopes[n - 2]);
  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const dx = (b.x - a.x) / 3;
    d += ` C ${(a.x + dx).toFixed(1)} ${(a.y + slopes[i] * dx).toFixed(1)}, ${(b.x - dx).toFixed(1)} ${(b.y - slopes[i + 1] * dx).toFixed(1)}, ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
  }
  return d;
}

export function TrendChart({ values, height = 124, color = colors.flame, baseline }: { values: number[]; height?: number; color?: string; baseline?: number }) {
  const [width, setWidth] = useState(0);
  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);

  const pad = 8;
  const max = Math.max(1, ...values);
  const span = max || 1;
  const n = values.length;
  const points: Point[] = n
    ? values.map((value, index) => ({ x: pad + (n === 1 ? 0.5 : index / (n - 1)) * (width - pad * 2), y: pad + (1 - value / span) * (height - pad * 2) }))
    : [];
  const line = smoothPath(points);
  const first = points[0];
  const last = points[points.length - 1];
  const area = first && last ? `${line} L ${last.x} ${height} L ${first.x} ${height} Z` : '';
  const baseY = baseline === undefined ? undefined : pad + (1 - Math.min(baseline, max) / span) * (height - pad * 2);

  return (
    <View onLayout={onLayout} style={{ height, width: '100%' }}>
      {width > 0 && points.length > 1 ? (
        <Svg width={width} height={height}>
          <Defs>
            <LinearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={color} stopOpacity={0.3} />
              <Stop offset="1" stopColor={color} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          {baseY !== undefined ? <Line x1={0} x2={width} y1={baseY} y2={baseY} stroke={colors.hairlineStrong} strokeDasharray="2 5" /> : null}
          <Path d={area} fill="url(#trend-fill)" />
          <Path d={line} stroke={color} strokeWidth={2.4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          {last ? (
            <>
              <Circle cx={last.x} cy={last.y} r={8} fill={color} opacity={0.18} />
              <Circle cx={last.x} cy={last.y} r={3.8} fill={color} stroke="#ffffff" strokeWidth={1.6} />
            </>
          ) : null}
        </Svg>
      ) : null}
    </View>
  );
}
