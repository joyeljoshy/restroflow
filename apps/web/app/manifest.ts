import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "RestroFlow Restaurant Operations Management",
    short_name: "RestroFlow",
    description:
      "Modern restaurant operations for menus, tables, orders, kitchen workflows, billing, and analytics.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#fbfaf7",
    theme_color: "#24745b",
    icons: [
      {
        src: "/icons/restroflow-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/restroflow-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
