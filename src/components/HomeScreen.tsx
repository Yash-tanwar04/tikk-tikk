import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import { RefreshCw, MessageSquareHeart, Sparkles } from 'lucide-react';
import { useLoveLink } from '../context/LoveLinkContext';
import { SIGNAL_CONFIGS } from './SignalConfigs';
import { SignalType } from '../types';
import { CustomMessageModal } from './CustomMessageModal';

function formatLastSeen(timestamp: number): string {
  if (!timestamp) return 'offline';
  const diffSec = Math.floor((Date.now() - timestamp) / 1000);
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}

interface HomeScreenProps {
  onNavigate?: (tab: 'home' | 'moments' | 'settings') => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ onNavigate }) => {
  const {
    partnerDisplayName,
    connectionState,
    partnerPresence,
    sendSignal,
    reconnectRealtime,
    signals,
    user
  } = useLoveLink();

  const [isSendingLove, setIsSendingLove] = useState(false);
  const [loveSentSuccess, setLoveSentSuccess] = useState(false);
  const [activeWaveKey, setActiveWaveKey] = useState<number>(0);
  const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);
  const [sendingType, setSendingType] = useState<SignalType | null>(null);

  // Latest signal
  const lastSignal = signals[0];
  const lastSignalConfig = lastSignal ? SIGNAL_CONFIGS[lastSignal.type] : null;

  const triggerHeartConfetti = () => {
    try {
      // Fire subtle romantic confetti from button center
      confetti({
        particleCount: 24,
        spread: 65,
        origin: { y: 0.52 },
        colors: ['#e11d48', '#f43f5e', '#fb7185', '#f5f5f4'],
        shapes: ['circle'],
        scalar: 0.85,
        disableForReducedMotion: true
      });
    } catch {
      // ignore
    }
  };

  const handleSendLove = async () => {
    if (isSendingLove) return;
    setIsSendingLove(true);
    setActiveWaveKey((prev) => prev + 1);
    triggerHeartConfetti();

    const result = await sendSignal('love');
    if (result.success) {
      setLoveSentSuccess(true);
      setTimeout(() => setLoveSentSuccess(false), 2400);
    }
    setIsSendingLove(false);
  };

  const handleQuickSignal = async (type: SignalType) => {
    setSendingType(type);
    await sendSignal(type);
    setTimeout(() => setSendingType(null), 1200);
  };

  const isPartnerOnline = partnerPresence.isOnline;

  return (
    <div className="flex-1 flex flex-col justify-between max-w-md mx-auto w-full px-5 pt-safe pb-28 min-h-screen relative z-10 select-none">
      {/* Top Editorial Masthead Header */}
      <header className="pt-4 pb-2 flex flex-col gap-2 border-b border-stone-800/80">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono tracking-[0.25em] text-stone-400 uppercase">
            Love Link • Private Sanctuary
          </span>

          {/* Realtime Connection Status Pill */}
          <div className="flex items-center">
            {connectionState === 'connected' ? (
              <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-stone-900 border border-stone-700 text-stone-300 text-[11px] font-mono backdrop-blur-md">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping" />
                <span>Synchronized</span>
              </div>
            ) : (
              <button
                id="reconnect-button"
                onClick={reconnectRealtime}
                className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-950/60 border border-amber-500/40 text-amber-300 text-[11px] font-mono backdrop-blur-md hover:bg-amber-900/60 transition"
              >
                <RefreshCw className="w-3 h-3 animate-spin" />
                <span>{connectionState === 'reconnecting' ? 'Reconnecting...' : 'Reconnect'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Partner Name & Live Presence */}
        <div className="flex items-end justify-between pt-1">
          <div>
            <span className="text-[10px] font-serif italic tracking-wider text-rose-300/80">
              Connected Heart
            </span>
            <h1 className="text-2xl font-editorial font-bold text-stone-100 tracking-tight flex items-center gap-2">
              <span>{partnerDisplayName}</span>
            </h1>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-stone-900/90 border border-stone-800 text-[11px]">
            <span
              className={`w-2 h-2 rounded-full ${
                isPartnerOnline
                  ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse'
                  : 'bg-stone-500'
              }`}
            />
            <span className={isPartnerOnline ? 'text-emerald-300 font-medium' : 'text-stone-400 font-mono text-[10px]'}>
              {isPartnerOnline ? 'Online now' : formatLastSeen(partnerPresence.lastSeen)}
            </span>
          </div>
        </div>
      </header>

      {/* Hero Interactive Main Button Area */}
      <main className="flex-1 flex flex-col items-center justify-center my-6 relative">
        {/* Outward Signal Shockwave Rings */}
        <AnimatePresence>
          {activeWaveKey > 0 && (
            <motion.div
              key={activeWaveKey}
              initial={{ scale: 0.8, opacity: 0.8 }}
              animate={{ scale: 2.2, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.4, ease: 'easeOut' }}
              className="absolute w-48 h-48 rounded-full border border-rose-500/70 pointer-events-none"
            />
          )}
        </AnimatePresence>

        {/* Outer Warm Hearth Glow Halo */}
        <div className="relative flex items-center justify-center">
          <div className="absolute -inset-8 rounded-full bg-gradient-to-tr from-rose-900/30 via-stone-800/20 to-red-950/20 blur-3xl animate-pulse-ring pointer-events-none" />
          <div className="absolute -inset-4 rounded-full bg-rose-500/15 blur-xl animate-breathe pointer-events-none" />

          {/* Central Touch Button (Editorial Medallion) */}
          <motion.button
            id="hero-send-love-button"
            aria-label={`Send love to ${partnerDisplayName}`}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.94 }}
            onClick={handleSendLove}
            className="relative w-52 h-52 sm:w-56 sm:h-56 rounded-full bg-gradient-to-b from-[#1c1819] via-[#141012] to-[#0d0a0c] border-2 border-stone-800 p-2 shadow-[0_0_50px_rgba(225,29,72,0.2)] flex flex-col items-center justify-center text-center cursor-pointer group active:border-rose-400 transition-colors focus:outline-none focus:ring-4 focus:ring-rose-500/20"
          >
            {/* Inner Ring Texture & Hairline Seal */}
            <div className="absolute inset-2.5 rounded-full border border-stone-700/60 pointer-events-none" />
            <div className="absolute inset-4 rounded-full bg-gradient-to-b from-rose-500/10 via-transparent to-rose-950/20 pointer-events-none" />
            <div className="absolute inset-6 rounded-full border border-white/5 pointer-events-none" />

            {/* Icon & Reaction */}
            <motion.div
              animate={{
                scale: isSendingLove ? [1, 1.3, 1] : [1, 1.06, 1],
                rotate: isSendingLove ? [0, -8, 8, 0] : 0
              }}
              transition={{
                duration: isSendingLove ? 0.4 : 3.2,
                repeat: isSendingLove ? 0 : Infinity,
                ease: 'easeInOut'
              }}
              className="text-5xl sm:text-6xl mb-2 drop-shadow-[0_0_20px_rgba(244,63,94,0.55)]"
            >
              ❤️
            </motion.div>

            {/* Label */}
            <span className="text-sm font-editorial font-bold tracking-[0.18em] text-stone-100 uppercase drop-shadow-sm">
              {loveSentSuccess ? 'HEARTBEAT SENT' : 'TRANSMIT LOVE'}
            </span>

            {/* Micro Quote Subtitle */}
            <span className="text-xs text-rose-200/75 font-reading italic mt-1 px-4 leading-tight">
              {loveSentSuccess ? 'Delivered to their phone ✨' : '"Thinking of you in this moment."'}
            </span>
          </motion.button>
        </div>

        {/* Subtext indicator */}
        <p className="mt-8 text-[11px] text-stone-400 font-serif italic tracking-wide flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-rose-400/80" />
          <span>Tap to vibrate {partnerDisplayName}'s phone in real time</span>
        </p>
      </main>

      {/* Secondary Signal Actions & Little Note */}
      <footer className="space-y-3 pt-2">
        {/* Quick Signal Bar */}
        <div className="grid grid-cols-4 gap-2">
          {(['hug', 'kiss', 'miss_you', 'call_me'] as SignalType[]).map((type) => {
            const cfg = SIGNAL_CONFIGS[type];
            const isCurrentlySending = sendingType === type;

            return (
              <motion.button
                key={type}
                id={`quick-signal-${type}`}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.94 }}
                onClick={() => handleQuickSignal(type)}
                className="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-stone-900/85 hover:bg-stone-800/90 border border-stone-800 active:border-rose-500/40 transition backdrop-blur-lg shadow-sm"
              >
                <span className="text-2xl mb-1 drop-shadow-sm">{cfg.icon}</span>
                <span className="text-[10px] font-editorial tracking-wider text-stone-300 uppercase">
                  {isCurrentlySending ? 'SENT' : cfg.label.split(' ')[0]}
                </span>
              </motion.button>
            );
          })}
        </div>

        {/* Send Little Message / Note Button (Editorial Stationery) */}
        <button
          id="open-custom-message-button"
          onClick={() => setIsMessageModalOpen(true)}
          className="w-full flex items-center justify-between px-4 py-3 rounded-2xl bg-stone-900/80 hover:bg-stone-850 border border-stone-800 hover:border-stone-700 active:scale-[0.99] transition backdrop-blur-xl group shadow-sm"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-rose-950/40 border border-rose-500/20 flex items-center justify-center text-rose-400 group-hover:bg-rose-900/40 transition">
              <MessageSquareHeart className="w-4 h-4" />
            </div>
            <div className="text-left">
              <div className="text-xs font-editorial font-semibold text-stone-200">Private Dispatch</div>
              <div className="text-[11px] text-stone-400 font-reading italic">"A little note for your thoughts..."</div>
            </div>
          </div>
          <span className="text-[11px] font-serif font-medium text-rose-300 bg-rose-950/40 px-3 py-1 rounded-full border border-rose-500/30">
            Write
          </span>
        </button>

        {/* Latest Activity Snippet */}
        {lastSignal && lastSignalConfig && (
          <div className="text-center pt-1 border-t border-stone-800/60">
            <p className="text-[11px] text-stone-400 font-reading">
              Last exchange:{' '}
              <span className="text-stone-200 font-medium">
                {lastSignal.senderId === user?.id ? 'You' : partnerDisplayName}{' '}
                {lastSignalConfig.verb} ({formatLastSeen(lastSignal.createdAt)})
              </span>
            </p>
          </div>
        )}
      </footer>

      {/* Custom Note Modal */}
      <CustomMessageModal
        isOpen={isMessageModalOpen}
        onClose={() => setIsMessageModalOpen(false)}
        onSend={(msg) => sendSignal('message', msg)}
        partnerName={partnerDisplayName}
      />
    </div>
  );
};
