import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "UPEC Accounting Software",
    short_name: "UPEC Accounts",
    description: "Financial management for the University of Port Harcourt Entrepreneurial Centre.",
    start_url: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#f6f8fb",
    theme_color: "#10284b",
    categories: ["finance", "business", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
