import type { DashboardRuntimeConfig } from "@torgash/types";

const ROUTE_SEGMENTS = new Set(["orders", "auction", "profile", "window-view"]);

export function getDashboardRuntimeConfig(): DashboardRuntimeConfig {
  const backendUrl = import.meta.env.VITE_MC_BACKEND_URL?.trim() || window.location.origin;
  const configuredPrefix = import.meta.env.VITE_MC_ROUTE_PREFIX?.trim();
  const routePrefix = normalizePrefix(configuredPrefix || inferPrefix(window.location.pathname));

  return {
    backendUrl,
    routePrefix,
    socketPath: `${joinRoute(routePrefix, "/viewer")}/socket.io`,
    viewerUrl: new URL(`${joinRoute(routePrefix, "/viewer")}/`, backendUrl).toString(),
  };
}

function inferPrefix(pathname: string): string {
  if (pathname === "/" || pathname === "") {
    return "";
  }

  const normalizedPath = pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  const segments = normalizedPath.split("/").filter(Boolean);
  const lastSegment = segments.at(-1);

  if (lastSegment && ROUTE_SEGMENTS.has(lastSegment)) {
    const prefixSegments = segments.slice(0, -1);

    return prefixSegments.length ? `/${prefixSegments.join("/")}` : "";
  }

  return normalizedPath;
}

function normalizePrefix(prefix: string): string {
  if (!prefix || prefix === "/") {
    return "";
  }

  return prefix.startsWith("/") ? prefix : `/${prefix}`;
}

function joinRoute(prefix: string, suffix: string): string {
  return prefix ? `${prefix}${suffix}` : suffix;
}
