// Web Audio API pure synthesizer for Love Link
// Generates luxury acoustic tones with zero external audio assets

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function playSignalSound(type: string, enabled = true) {
  if (!enabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  switch (type) {
    case 'love':
      playLoveChime(ctx, now);
      break;
    case 'hug':
      playHugPulse(ctx, now);
      break;
    case 'kiss':
      playKissChirp(ctx, now);
      break;
    case 'miss_you':
      playMissYouMelody(ctx, now);
      break;
    case 'call_me':
      playCallMeBell(ctx, now);
      break;
    case 'sent':
      playSentWhoosh(ctx, now);
      break;
    default:
      playLoveChime(ctx, now);
  }
}

function playLoveChime(ctx: AudioContext, startTime: number) {
  // Harmonic celestial major third / fifth chime: 528Hz (Love freq), 660Hz, 792Hz
  const freqs = [528, 660, 792, 1056];
  freqs.forEach((freq, index) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, startTime + index * 0.06);

    const noteStart = startTime + index * 0.06;
    gain.gain.setValueAtTime(0, noteStart);
    gain.gain.linearRampToValueAtTime(0.18 / (index + 1), noteStart + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, noteStart + 1.6);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(noteStart);
    osc.stop(noteStart + 1.7);
  });
}

function playHugPulse(ctx: AudioContext, startTime: number) {
  // Deep warm bass resonance with harmonic warmth
  const osc = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();

  osc.type = 'triangle';
  osc.frequency.setValueAtTime(140, startTime);
  osc.frequency.exponentialRampToValueAtTime(80, startTime + 1.2);

  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(300, startTime);
  filter.frequency.exponentialRampToValueAtTime(150, startTime + 1.2);

  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(0.3, startTime + 0.15);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 1.4);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  osc.start(startTime);
  osc.stop(startTime + 1.5);
}

function playKissChirp(ctx: AudioContext, startTime: number) {
  // Playful sparkle chirp
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(700, startTime);
  osc.frequency.exponentialRampToValueAtTime(1200, startTime + 0.08);
  osc.frequency.exponentialRampToValueAtTime(950, startTime + 0.2);

  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(0.22, startTime + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.35);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(startTime);
  osc.stop(startTime + 0.4);
}

function playMissYouMelody(ctx: AudioContext, startTime: number) {
  // Gentle melancholic ascending & resolving dual-tone
  const notes = [440, 554.37, 659.25]; // A4, C#5, E5
  notes.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    const noteStart = startTime + idx * 0.14;
    osc.frequency.setValueAtTime(freq, noteStart);

    gain.gain.setValueAtTime(0, noteStart);
    gain.gain.linearRampToValueAtTime(0.16, noteStart + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, noteStart + 1.2);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(noteStart);
    osc.stop(noteStart + 1.3);
  });
}

function playCallMeBell(ctx: AudioContext, startTime: number) {
  // Double soft notification chime
  [0, 0.22].forEach((offset) => {
    const t = startTime + offset;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, t);
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1320, t);

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.18, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(t);
    osc2.start(t);
    osc1.stop(t + 0.85);
    osc2.stop(t + 0.85);
  });
}

function playSentWhoosh(ctx: AudioContext, startTime: number) {
  // Quick subtle soft rising confirmation sound
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(320, startTime);
  osc.frequency.exponentialRampToValueAtTime(640, startTime + 0.12);

  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(0.12, startTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.2);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(startTime);
  osc.stop(startTime + 0.22);
}
