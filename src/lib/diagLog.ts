// TEMP DEBUG — remove after diagnosis (branch diag/farcaster-splash).
//
// Tiny ring-buffer logger that mirrors to console AND feeds the on-screen
// DiagOverlay, so the Farcaster splash-bounce cause can be read/screenshotted
// on a phone (where there's no console). Behaviour-free: only records.

type Listener = (lines: string[]) => void;

const buffer: string[] = [];
const listeners = new Set<Listener>();
let seq = 0;

function safeJson(data: Record<string, unknown>): string {
  try {
    return JSON.stringify(data);
  } catch {
    return String(data);
  }
}

export function diag(tag: string, data?: Record<string, unknown>): void {
  seq += 1;
  const line = `${seq} ${tag}${data ? " " + safeJson(data) : ""}`;
  try {
    // eslint-disable-next-line no-console
    console.log("[DIAG]", line);
  } catch {
    /* ignore */
  }
  buffer.push(line);
  while (buffer.length > 40) buffer.shift();
  listeners.forEach((l) => {
    try {
      l([...buffer]);
    } catch {
      /* ignore */
    }
  });
}

export function subscribeDiag(l: Listener): () => void {
  listeners.add(l);
  l([...buffer]);
  return () => {
    listeners.delete(l);
  };
}
