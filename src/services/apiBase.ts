export function getApiBase() {
  const configured = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? "http://127.0.0.1:3001" : "");
  const isLocalPage = ["127.0.0.1", "localhost"].includes(window.location.hostname);

  if (!isLocalPage && pointsToLocalhost(configured)) {
    return "";
  }

  return configured;
}

function pointsToLocalhost(value: string) {
  return value.includes("127.0.0.1") || value.includes("localhost");
}
