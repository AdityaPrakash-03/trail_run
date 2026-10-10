const KEY = "trial-run-face-v1";
let sessionFace: string | null = null;

export function getFace(): string | null {
  try {
    sessionFace = localStorage.getItem(KEY) ?? sessionFace;
  } catch {}
  return sessionFace;
}

export function setFace(value: string): void {
  sessionFace = value;
  try { localStorage.setItem(KEY, value); } catch {}
}

export function removeFace(): void {
  sessionFace = null;
  try { localStorage.removeItem(KEY); } catch {}
}
