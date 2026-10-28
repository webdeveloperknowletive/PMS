import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SprintIX Project Workspace",
    short_name: "SprintIX",
    description: "Manage projects, tasks, teams, and sprints in one place.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#ffffff",
    theme_color: "#5b4bdb",
    icons: [{ src: "/sprintix-logo-hd.png", sizes: "1254x1254", type: "image/png", purpose: "any" }],
  };
}
