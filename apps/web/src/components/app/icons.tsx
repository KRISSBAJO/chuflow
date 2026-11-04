const PATHS = {
  home: "M3 10.5L12 3l9 7.5V20a1 1 0 01-1 1h-5v-6h-6v6H4a1 1 0 01-1-1z",
  approvals: "M12 3l7 3v6c0 4.5-3 7.7-7 9-4-1.3-7-4.5-7-9V6zM9 12l2 2 4-4",
  message: "M21 12a8 8 0 01-11.6 7.1L4 20l1-4.4A8 8 0 1121 12z",
  guests: "M15 19a6 6 0 00-12 0M9 11a4 4 0 100-8 4 4 0 000 8zM19 8v6M22 11h-6",
  care: "M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z",
  members: "M16 20a4 4 0 00-8 0M12 12a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM21 20a3.5 3.5 0 00-3-3.5M17.5 5a3 3 0 010 6M3 20a3.5 3.5 0 013-3.5M6.5 5a3 3 0 000 6",
  units: "M12 3l9 5-9 5-9-5zM3 13l9 5 9-5",
  attendance: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4M9 15l2 2 4-4",
  weekly: "M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6",
  maag: "M4 20V10M10 20V4M16 20v-7M2 20h20",
  finance: "M3 8h16a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2zM3 8l12-5v5M16 14h.01",
  branches: "M4 21V6l8-3 8 3v15M9 21v-5h6v5M9 9h.01M15 9h.01M9 12.5h.01M15 12.5h.01",
  structure: "M9 3h6v5H9zM3 16h6v5H3zM15 16h6v5h-6zM12 8v4M6 16v-4h12v4",
  users: "M12 11a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0",
  templates: "M4 4h16v6H4zM4 14h7v6H4zM15 14h5v6h-5z",
  reports: "M4 19h16M7 16V10M12 16V5M17 16v-4",
  settings: "M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1M15 4v4M9 10v4M17 16v4",
  search: "M11 18a7 7 0 100-14 7 7 0 000 14zM20 20l-3.5-3.5",
  bell: "M6 9a6 6 0 0112 0c0 6 2.5 8 2.5 8h-17S6 15 6 9zM10.3 20a1.9 1.9 0 003.4 0",
  plus: "M12 5v14M5 12h14",
  logout: "M15 17l5-5-5-5M20 12H9M12 21H5a2 2 0 01-2-2V5a2 2 0 012-2h7",
  sidebar: "M4 4h16v16H4zM9.5 4v16",
  menu: "M4 8h16M4 16h16",
  close: "M6 6l12 12M18 6L6 18",
  arrowRight: "M5 12h14M13 6l6 6-6 6",
  arrowUpRight: "M7 17L17 7M8 7h9v9",
  arrowLeft: "M19 12H5M11 6l-6 6 6 6",
  chevronDown: "M6 9l6 6 6-6",
  pin: "M12 21s-7-6.2-7-11.5a7 7 0 0114 0C19 14.8 12 21 12 21zM12 12a2.5 2.5 0 100-5 2.5 2.5 0 000 5z",
  alert: "M12 9v4M12 17h.01M10.3 3.9L2 18a2 2 0 001.7 3h16.6a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z",
  trendUp: "M3 17l6-6 4 4 8-8M15 7h6v6",
  trendDown: "M3 7l6 6 4-4 8 8M15 17h6v-6",
  clock: "M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v5l3 2",
  sparkle: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z",
  device: "M8 2.75h8a1.75 1.75 0 011.75 1.75v15A1.75 1.75 0 0116 21.25H8a1.75 1.75 0 01-1.75-1.75v-15A1.75 1.75 0 018 2.75zM11 18h2",
  share: "M12 3v12M8 7l4-4 4 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  check: "M5 12.5l4.5 4.5L19 7.5",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, className = "h-[18px] w-[18px]", strokeWidth = 1.7 }: { name: IconName; className?: string; strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} className={className} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d={PATHS[name]} />
    </svg>
  );
}
