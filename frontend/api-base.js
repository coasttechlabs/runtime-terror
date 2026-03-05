const DEFAULT_RENDER_API_BASE = "https://runtime-terror-4ti4.onrender.com/api";

function normalizeBase(value) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\/+$/, "");
}

export function getApiBase() {
  const runtimeOverride = normalizeBase(window.API_BASE);
  if (runtimeOverride) return runtimeOverride;

  const metaOverride = normalizeBase(
    document.querySelector('meta[name="runtime-api-base"]')?.getAttribute("content") || ""
  );
  if (metaOverride) return metaOverride;

  const storageOverride = normalizeBase(window.localStorage?.getItem("API_BASE") || "");
  if (storageOverride) return storageOverride;

  const devPorts = new Set(["3000", "4173", "5173", "5500", "8000", "10000"]);
  if (window.location.protocol === "file:" || devPorts.has(window.location.port)) {
    const host = window.location.hostname || "127.0.0.1";
    return `http://${host}:8000/api`;
  }

  if (window.location.hostname.endsWith(".netlify.app")) {
    return DEFAULT_RENDER_API_BASE;
  }

  return `${window.location.origin}/api`;
}
