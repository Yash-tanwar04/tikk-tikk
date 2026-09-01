// Mobile haptic vibration engine

export function triggerHaptic(type: string, enabled = true) {
  if (!enabled || typeof navigator === 'undefined' || !navigator.vibrate) {
    return;
  }

  try {
    switch (type) {
      case 'love':
        // Heartbeat rhythmic pulse: bump... bum-bump
        navigator.vibrate([120, 80, 240]);
        break;
      case 'hug':
        // Long warm enveloping vibration
        navigator.vibrate([350, 100, 350]);
        break;
      case 'kiss':
        // Quick gentle flutter
        navigator.vibrate([50, 40, 50, 40, 90]);
        break;
      case 'miss_you':
        // Slow tender pulse
        navigator.vibrate([150, 150, 150]);
        break;
      case 'call_me':
        // Prominent alert pattern
        navigator.vibrate([200, 100, 200, 100, 350]);
        break;
      case 'tap':
        // Subtle micro-tap
        navigator.vibrate(15);
        break;
      case 'success':
        navigator.vibrate([40, 60, 80]);
        break;
      default:
        navigator.vibrate(80);
    }
  } catch (err) {
    // Non-fatal if browser blocks vibration without direct gesture
  }
}
