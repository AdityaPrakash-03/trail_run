/** crypto.randomUUID only exists on https or localhost. Phones on a LAN dev URL need a fallback. */
export function uid(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function")
      return crypto.randomUUID();
  } catch {
    /* fall through */
  }
  return "id-" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
