import { SignalConfig, SignalType } from '../types';

export const SIGNAL_CONFIGS: Record<SignalType, SignalConfig> = {
  love: {
    type: 'love',
    label: 'Send Love',
    verb: 'sent you love',
    receivedTitle: 'THINKING OF YOU',
    receivedSubtext: 'Love received ❤️',
    icon: '❤️',
    accentColor: '#f43f5e',
    glowColor: 'rgba(244, 63, 94, 0.45)',
    gradient: 'from-rose-500 to-pink-600'
  },
  hug: {
    type: 'hug',
    label: 'Warm Hug',
    verb: 'sent you a hug',
    receivedTitle: 'WARM EMBRACE',
    receivedSubtext: 'Wrapping you in a warm hug 🫂',
    icon: '🫂',
    accentColor: '#fb923c',
    glowColor: 'rgba(251, 146, 60, 0.45)',
    gradient: 'from-amber-500 to-orange-600'
  },
  kiss: {
    type: 'kiss',
    label: 'Sweet Kiss',
    verb: 'sent you a kiss',
    receivedTitle: 'SWEET KISS',
    receivedSubtext: 'A little kiss just for you 💋',
    icon: '💋',
    accentColor: '#ec4899',
    glowColor: 'rgba(236, 72, 153, 0.45)',
    gradient: 'from-pink-500 to-rose-600'
  },
  miss_you: {
    type: 'miss_you',
    label: 'Miss You',
    verb: 'misses you',
    receivedTitle: 'MISSING YOU',
    receivedSubtext: 'Wishing you were here 🥺',
    icon: '🥺',
    accentColor: '#a855f7',
    glowColor: 'rgba(168, 85, 247, 0.45)',
    gradient: 'from-purple-500 to-indigo-600'
  },
  call_me: {
    type: 'call_me',
    label: 'Call Me',
    verb: 'wants to talk',
    receivedTitle: 'CALL REQUEST',
    receivedSubtext: 'They want to hear your voice 📞',
    icon: '📞',
    accentColor: '#06b6d4',
    glowColor: 'rgba(6, 182, 212, 0.45)',
    gradient: 'from-cyan-500 to-blue-600'
  },
  message: {
    type: 'message',
    label: 'Little Note',
    verb: 'sent a note',
    receivedTitle: 'LITTLE NOTE',
    receivedSubtext: 'A personal message for you 💌',
    icon: '💌',
    accentColor: '#e879f9',
    glowColor: 'rgba(232, 121, 249, 0.45)',
    gradient: 'from-fuchsia-500 to-rose-500'
  }
};
