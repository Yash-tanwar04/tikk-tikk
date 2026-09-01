import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Sparkles, PhoneCall } from 'lucide-react';
import { useLoveLink } from '../context/LoveLinkContext';
import { SIGNAL_CONFIGS } from './SignalConfigs';
import { SignalType } from '../types';

export const SignalReceiverOverlay: React.FC = () => {
  const { activeIncomingSignal, dismissIncomingSignal, partnerDisplayName, sendSignal } = useLoveLink();

  // Auto-dismiss notification overlay after 12 seconds if not interacted with
  useEffect(() => {
    if (!activeIncomingSignal) return;
    const timer = setTimeout(() => {
      dismissIncomingSignal();
    }, 12000);
    return () => clearTimeout(timer);
  }, [activeIncomingSignal, dismissIncomingSignal]);

  if (!activeIncomingSignal) return null;

  const cfg = SIGNAL_CONFIGS[activeIncomingSignal.type] || SIGNAL_CONFIGS.love;
  const isCustomMessage = activeIncomingSignal.type === 'message' || Boolean(activeIncomingSignal.message);
  const isCall = activeIncomingSignal.type === 'call_me';

  const handleReply = async () => {
    // Reply back with same signal type or love
    const replyType: SignalType = isCall ? 'call_me' : activeIncomingSignal.type;
    await sendSignal(replyType);
    dismissIncomingSignal();
  };

  return (
    <AnimatePresence>
      <div
        id="signal-receiver-backdrop"
        className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-xl bg-black/60 select-none"
      >
        {/* Full-screen ambient atmospheric burst */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 0.8, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6 }}
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(circle at 50% 45%, ${cfg.glowColor} 0%, rgba(9,9,11,0.9) 70%)`
          }}
        />

        {/* Floating Signal Card */}
        <motion.div
          id="signal-received-card"
          initial={{ scale: 0.85, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 15 }}
          transition={{ type: 'spring', damping: 24, stiffness: 300 }}
          className="relative w-full max-w-sm rounded-3xl bg-stone-900 border border-stone-800 p-6 shadow-2xl shadow-black text-center overflow-hidden backdrop-blur-2xl"
        >
          {/* Top glow rim */}
          <div
            className="absolute top-0 left-0 right-0 h-1.5 opacity-90"
            style={{ backgroundColor: cfg.accentColor }}
          />

          {/* Close button */}
          <button
            id="dismiss-signal-button"
            onClick={dismissIncomingSignal}
            aria-label="Dismiss signal"
            className="absolute top-4 right-4 p-2 rounded-full bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-stone-100 transition"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Icon with breathing spring */}
          <div className="relative my-4 flex justify-center">
            <motion.div
              animate={{
                scale: [1, 1.25, 1],
                rotate: [0, -6, 6, 0]
              }}
              transition={{
                duration: 1.8,
                repeat: Infinity,
                ease: 'easeInOut'
              }}
              className="text-6xl sm:text-7xl drop-shadow-[0_0_24px_rgba(225,29,72,0.6)]"
            >
              {cfg.icon}
            </motion.div>
          </div>

          {/* Header Typography */}
          <div className="space-y-1">
            <div className="flex items-center justify-center gap-1 text-[11px] font-mono tracking-widest text-rose-400 uppercase">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{partnerDisplayName} {cfg.verb}</span>
            </div>
            <h2 className="text-2xl font-editorial font-bold text-stone-100 tracking-tight">
              {cfg.receivedTitle}
            </h2>
          </div>

          {/* Note or Subtext */}
          <div className="my-5 p-4 rounded-2xl bg-stone-950 border border-stone-800/90 shadow-inner">
            {activeIncomingSignal.message ? (
              <p className="text-sm text-stone-100 font-reading italic leading-relaxed">
                "{activeIncomingSignal.message}"
              </p>
            ) : (
              <p className="text-xs text-stone-300 font-reading italic">
                {cfg.receivedSubtext}
              </p>
            )}
            <span className="block text-[10px] text-stone-400 mt-2 font-mono">
              Synchronized just now
            </span>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2">
            <motion.button
              id="reply-signal-button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.96 }}
              onClick={handleReply}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-rose-900/90 hover:bg-rose-800 text-white text-xs font-serif font-semibold tracking-wider shadow-lg shadow-rose-950/60 transition cursor-pointer border border-rose-700/50"
            >
              {isCall ? (
                <>
                  <PhoneCall className="w-4 h-4" />
                  <span>CALL {partnerDisplayName.toUpperCase()} BACK</span>
                </>
              ) : (
                <>
                  <span>{cfg.icon}</span>
                  <span>TRANSMIT {cfg.label.split(' ')[0].toUpperCase()} BACK</span>
                </>
              )}
            </motion.button>

            <button
              id="dismiss-text-button"
              onClick={dismissIncomingSignal}
              className="w-full py-2 text-xs font-serif text-stone-400 hover:text-stone-200 transition"
            >
              Dismiss Whisper
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
