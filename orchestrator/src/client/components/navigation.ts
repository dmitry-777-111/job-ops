import {
  Columns3,
  Eye,
  FilePenLine,
  Home,
  Inbox,
  LayoutDashboard,
  Link2,
  Settings,
  Shield,
  Sparkles,
} from "lucide-react";

export type NavLink = {
  to: string;
  label: string;
  icon: typeof Home;
  activePaths?: string[];
};

export const NAV_LINKS: NavLink[] = [
  { to: "/overview", label: "Overview", icon: Home },
  {
    to: "/jobs/ready",
    label: "Jobs",
    icon: LayoutDashboard,
    activePaths: [
      "/jobs/ready",
      "/jobs/discovered",
      "/jobs/applied",
      "/jobs/all",
    ],
  },
  {
    to: "/applications/in-progress",
    label: "In Progress",
    icon: Columns3,
    activePaths: ["/applications/in-progress"],
  },
  {
    to: "/design-resume",
    label: "Resume Studio",
    icon: FilePenLine,
    activePaths: ["/design-resume"],
  },
  { to: "/tracking-inbox", label: "Tracking Inbox", icon: Inbox },
  {
    to: "/tracer-links",
    label: "Tracer Links",
    icon: Link2,
    activePaths: ["/tracer-links"],
  },
  { to: "/visa-sponsors", label: "Visa Sponsors", icon: Shield },
  { to: "/watchlist", label: "Watchlist", icon: Eye },
  { to: "/settings", label: "Settings", icon: Settings },
];

export const CANDIDATE_NAV_LINKS: NavLink[] = [
  { to: "/overview", label: "Today", icon: Home },
  {
    to: "/jobs/ready",
    label: "Matches",
    icon: LayoutDashboard,
    activePaths: [
      "/jobs/ready",
      "/jobs/discovered",
      "/jobs/applied",
      "/jobs/all",
    ],
  },
  {
    to: "/applications/in-progress",
    label: "Applications",
    icon: Columns3,
    activePaths: ["/applications/in-progress"],
  },
  {
    to: "/improve",
    label: "Improve",
    icon: Sparkles,
    activePaths: ["/improve"],
  },
  {
    to: "/design-resume",
    label: "Profile",
    icon: FilePenLine,
    activePaths: ["/design-resume"],
  },
  {
    to: "/settings",
    label: "Connections",
    icon: Link2,
    activePaths: ["/settings"],
  },
];

export function resolveNavLinks(args: {
  appMode: "local" | "hosted";
  isSystemAdmin: boolean;
}): NavLink[] {
  if (!args.isSystemAdmin) {
    return CANDIDATE_NAV_LINKS;
  }

  if (args.appMode === "hosted") {
    return NAV_LINKS.filter(({ to }) => to !== "/tracking-inbox");
  }

  return NAV_LINKS;
}

export const isNavActive = (
  pathname: string,
  to: string,
  activePaths?: string[],
) => {
  if (pathname === to) return true;
  if (!activePaths) return false;
  return activePaths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
};
