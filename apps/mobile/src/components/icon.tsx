import type { ColorValue } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors } from '@/constants/theme';

/* Same 24px stroke icons as the web app (apps/web/src/components/app/icons.tsx). */
const PATHS = {
  home: 'M3 10.5L12 3l9 7.5V20a1 1 0 01-1 1h-5v-6h-6v6H4a1 1 0 01-1-1z',
  approvals: 'M12 3l7 3v6c0 4.5-3 7.7-7 9-4-1.3-7-4.5-7-9V6zM9 12l2 2 4-4',
  guests: 'M15 19a6 6 0 00-12 0M9 11a4 4 0 100-8 4 4 0 000 8zM19 8v6M22 11h-6',
  care: 'M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z',
  members: 'M16 20a4 4 0 00-8 0M12 12a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM21 20a3.5 3.5 0 00-3-3.5M17.5 5a3 3 0 010 6M3 20a3.5 3.5 0 013-3.5M6.5 5a3 3 0 000 6',
  attendance: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4M9 15l2 2 4-4',
  finance: 'M3 8h16a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2zM3 8l12-5v5M16 14h.01',
  reports: 'M4 20V10M10 20V4M16 20v-7M2 20h20',
  settings: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 01-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 010-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 014 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 010 4h-.1a1.7 1.7 0 00-1.5 1z',
  search: 'M11 18a7 7 0 100-14 7 7 0 000 14zM20 20l-4-4',
  bell: 'M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  close: 'M6 6l12 12M18 6L6 18',
  chevronRight: 'M9 6l6 6-6 6',
  chevronLeft: 'M15 6l-6 6 6 6',
  phone: 'M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2',
  message: 'M21 12a8 8 0 01-11.6 7.1L4 20l1-4.4A8 8 0 1121 12z',
  whatsapp: 'M3.5 20.5l1.3-3.9A8.5 8.5 0 1 1 8 19.6zM9.2 8.6c.3-.5.9-.5 1.1 0l.7 1.4c.2.4.1.8-.2 1.1l-.4.4a5 5 0 002.3 2.3l.4-.4c.3-.3.7-.4 1.1-.2l1.4.7c.5.2.5.8 0 1.1-.8.5-1.8.6-2.7.2a8 8 0 01-4.1-4.1c-.4-.9-.3-1.9.1-2.5z',
  mail: 'M4 6h16v12H4zM4 7l8 6 8-6',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  clock: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v5l3 2',
  cloudOff: 'M3 3l18 18M8.5 8.6A5 5 0 006 18h11M20.7 15.6A4 4 0 0016.5 10a6 6 0 00-6.3-4.4',
  lock: 'M6 11h12v10H6zM8.5 11V7.5a3.5 3.5 0 017 0V11',
  logout: 'M15 17l5-5-5-5M20 12H9M12 21H5a2 2 0 01-2-2V5a2 2 0 012-2h7',
  globe: 'M12 21a9 9 0 100-18 9 9 0 000 18zM3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18',
  sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z',
  more: 'M4 7h16M4 12h16M4 17h16',
  alert: 'M12 9v4M12 17h.01M10.3 3.9L2.4 18a2 2 0 001.7 3h15.8a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z',
  user: 'M20 21a8 8 0 00-16 0M12 13a5 5 0 100-10 5 5 0 000 10z',
  refresh: 'M20 11a8 8 0 00-14.9-3M4 4v4h4M4 13a8 8 0 0014.9 3M20 20v-4h-4',
  arrowUpRight: 'M7 17L17 7M8 7h9v9',
  arrowRight: 'M5 12h14M13 6l6 6-6 6',
  calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  cash: 'M3 7h18v10H3zM12 15a3 3 0 100-6 3 3 0 000 6zM6 12h.01M18 12h.01',
  chart: 'M4 19h16M7 16V9M12 16V5M17 16v-6',
  trending: 'M3 17l6-6 4 4 8-8M15 7h6v6',
  qr: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2v2h-2zM14 18h2v2h-2zM18 18h2v2h-2z',
  camera: 'M4 8h3l2-3h6l2 3h3v11H4zM12 16a3.5 3.5 0 100-7 3.5 3.5 0 000 7z',
  scan: 'M4 8V5a1 1 0 011-1h3M16 4h3a1 1 0 011 1v3M20 16v3a1 1 0 01-1 1h-3M8 20H5a1 1 0 01-1-1v-3M4 12h16',
  mapPin: 'M12 21s-6-5.5-6-11a6 6 0 0112 0c0 5.5-6 11-6 11zM12 12a2 2 0 100-4 2 2 0 000 4z',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z',
  building: 'M4 21V5l8-2v18M12 21V9l8 2v10M3 21h18M8 8h.01M8 12h.01M8 16h.01M16 14h.01M16 18h.01',
  file: 'M6 3h8l4 4v14H6zM14 3v4h4M9 13h6M9 17h6',
  send: 'M21 3L10 14M21 3l-7 18-4-7-7-4z',
  filter: 'M3 5h18l-7 8v6l-4 2v-8z',
  edit: 'M4 20h4l10-10-4-4L4 16zM13 7l4 4',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
  link: 'M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1',
  print: 'M6 9V3h12v6M6 18H4v-9h16v9h-2M6 14h12v7H6z',
  info: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 11v5M12 8h.01',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 100-6 3 3 0 000 6z',
  eyeOff: 'M3 3l18 18M10.6 10.6A3 3 0 0013.4 13.4M9.9 5.2A10 10 0 0112 5c6 0 10 7 10 7a17 17 0 01-3.2 3.9M6.6 6.6A17 17 0 002 12s4 7 10 7a10 10 0 005.4-1.6',
  checkCircle: 'M12 21a9 9 0 100-18 9 9 0 000 18zM8.5 12.5l2.5 2.5 4.5-5',
  xCircle: 'M12 21a9 9 0 100-18 9 9 0 000 18zM9 9l6 6M15 9l-6 6',
  smile: 'M12 21a9 9 0 100-18 9 9 0 000 18zM8.5 14a4.5 4.5 0 007 0M9 10h.01M15 10h.01',
  baby: 'M12 20a7 7 0 100-14 7 7 0 000 14zM9 12h.01M15 12h.01M10 15a3 3 0 004 0M12 6V3M9 4l3-1 3 1',
  door: 'M4 21h16M6 21V4a1 1 0 011-1h10a1 1 0 011 1v17M14 12h.01',
  clipboard: 'M8 4h8v3H8zM6 6h2v14h8V6h2v16H6zM10 12h4M10 16h4',
  megaphone: 'M3 10v4h3l8 5V5L6 10zM17 9a4 4 0 010 6',
  book: 'M4 4h7a2 2 0 012 2v14a2 2 0 00-2-2H4zM20 4h-7a2 2 0 00-2 2v14a2 2 0 012-2h7z',
  tag: 'M3 12V4h8l10 10-8 8zM7.5 8.5h.01',
  list: 'M9 6h12M9 12h12M9 18h12M4 6h.01M4 12h.01M4 18h.01',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  history: 'M4 11a8 8 0 112 5.3M3 7v4h4M12 8v4l3 2',
  download: 'M12 4v12M7 11l5 5 5-5M4 20h16',
  hash: 'M5 9h14M5 15h14M10 4L8 20M16 4l-2 16',
  key: 'M14 10a5 5 0 10-4.6 3L4 18.4V21h3v-2h2v-2h2l2.4-2.4A5 5 0 0014 10zM15.5 8.5h.01',
  share: 'M4 12v8h16v-8M12 3v13M8 7l4-4 4 4',
  units: 'M3 6h18M3 12h18M3 18h18M7 3v18M17 3v18',
  weekly: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4M8 14h2M12 14h2M16 14h2',
  moon: 'M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({
  name,
  size = 20,
  color = colors.ink,
  strokeWidth = 1.8,
}: {
  name: IconName;
  size?: number;
  color?: ColorValue;
  strokeWidth?: number;
}) {
  return <Glyph d={PATHS[name]} size={size} color={color} strokeWidth={strokeWidth} />;
}

/** A one-off 24px stroke icon from a path, for feature modules that need a glyph not listed above. */
export function Glyph({ d, size = 20, color = colors.ink, strokeWidth = 1.8 }: { d: string; size?: number; color?: ColorValue; strokeWidth?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
      <Path d={d} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
