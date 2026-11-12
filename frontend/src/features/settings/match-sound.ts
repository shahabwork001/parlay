/** A short, quiet two-note chime made with Web Audio (no audio file to download). */
export function playMatchSound(): void {
  if (typeof window === "undefined" || typeof AudioContext === "undefined") return;
  const context = new AudioContext();
  const now = context.currentTime;
  for (const [index, frequency] of [660, 880].entries()) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    const start = now + index * 0.12;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.08, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.25);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + 0.3);
  }
  window.setTimeout(() => void context.close(), 800);
}
