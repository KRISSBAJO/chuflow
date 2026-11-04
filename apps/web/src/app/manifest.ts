import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  const shortcutIcon = [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }];

  return {
    id: "/",
    name: "ChuFlow",
    short_name: "ChuFlow",
    description: "Guests, follow-up, attendance and reports for every branch of your church.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    categories: ["productivity", "lifestyle"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Register a guest", short_name: "New guest", url: "/guests", icons: shortcutIcon },
      { name: "Follow-up", url: "/follow-up", icons: shortcutIcon },
      { name: "Attendance", url: "/attendance", icons: shortcutIcon },
      { name: "Approvals", url: "/approvals", icons: shortcutIcon },
    ],
  };
}
