// Zero-asset browser-native Web Audio chime, pop sound & rainbow confetti bursts

const RAINBOW_COLORS = ['#FF5A36', '#10B981', '#8B5CF6', '#F59E0B', '#06B6D4', '#EC4899'];

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  return new Ctx();
}

/**
 * Plays a crisp, cheerful 3-note ascending bell chord (C5 -> E5 -> G5) on attendance success.
 */
export function playSuccessChime(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
    const now = ctx.currentTime;

    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = idx === 2 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);

      gain.gain.setValueAtTime(0.0001, now + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.08, now + idx * 0.08 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.08 + 0.28);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 0.3);
    });

    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 600);
  } catch {
    // Ignore audio errors when autoplay is blocked
  }
}

/**
 * Plays a subtle soft pop when students tap badges, vibe emojis, or Dinner RSVP.
 */
export function playPopSound(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(660, now + 0.07);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.06, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.085);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.09);

    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 180);
  } catch {
    // Ignore audio errors
  }
}

/**
 * Triggers festive rainbow confetti using canvas-confetti if loaded.
 */
export function fireFestiveConfetti(intensity: 'mini' | 'full' = 'mini'): void {
  try {
    const confettiFn = typeof window !== 'undefined' ? (window as unknown as { confetti?: (opts: any) => void }).confetti : undefined;
    if (typeof confettiFn !== 'function') return;

    if (intensity === 'mini') {
      confettiFn({
        particleCount: 35,
        spread: 55,
        origin: { y: 0.7 },
        colors: RAINBOW_COLORS,
      });
      return;
    }

    confettiFn({
      particleCount: 55,
      angle: 60,
      spread: 55,
      origin: { x: 0.15, y: 0.65 },
      colors: RAINBOW_COLORS,
    });
    confettiFn({
      particleCount: 55,
      angle: 120,
      spread: 55,
      origin: { x: 0.85, y: 0.65 },
      colors: RAINBOW_COLORS,
    });

    setTimeout(() => {
      confettiFn({
        particleCount: 65,
        spread: 85,
        origin: { x: 0.5, y: 0.55 },
        colors: RAINBOW_COLORS,
      });
    }, 180);
  } catch {
    // Ignore confetti errors
  }
}
