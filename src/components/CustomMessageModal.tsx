import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Send, Sparkles } from 'lucide-react';

interface CustomMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: (message: string) => Promise<{ success: boolean; error?: string }>;
  partnerName: string;
}

const SUGGESTED_PROMPTS = [
  "Can't stop thinking about you ❤️",
  "Just wanted to hear your voice",
  "Sending you the biggest warm squeeze",
  "Counting down until I see you ✨",
  "You make my day brighter",
  "Thinking about your smile"
];

export const CustomMessageModal: React.FC<CustomMessageModalProps> = ({
  isOpen,
  onClose,
  onSend,
  partnerName
}) => {
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || isSending) return;

    setIsSending(true);
    const result = await onSend(message.trim());
    setIsSending(false);

    if (result.success) {
      setMessage('');
      onClose();
    }
  };

  const handleSelectPrompt = (prompt: string) => {
    setMessage(prompt);
  };

  return (
    <AnimatePresence>
      <div
        id="custom-message-backdrop"
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md"
      >
        <motion.div
          id="custom-message-sheet"
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 26, stiffness: 320 }}
          className="w-full max-w-md bg-stone-900 border border-stone-800 rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto pb-safe"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-stone-800 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-rose-950/40 border border-rose-500/20 text-rose-400">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] font-mono tracking-widest text-stone-400 uppercase">
                  Private Dispatch
                </span>
                <h3 className="text-base font-editorial font-bold text-stone-100">
                  Write to {partnerName}
                </h3>
              </div>
            </div>

            <button
              id="close-custom-message-modal"
              onClick={onClose}
              className="p-1.5 rounded-full bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-stone-100 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <textarea
                id="custom-message-input"
                rows={3}
                maxLength={180}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Write a sweet whisper from the heart..."
                className="w-full p-4 rounded-2xl bg-stone-950 border border-stone-800 text-sm text-stone-100 placeholder-stone-600 font-reading italic focus:outline-none focus:border-rose-500/50 resize-none shadow-inner"
                autoFocus
              />
              <div className="flex justify-end text-[10px] font-mono text-stone-500 mt-1">
                {message.length}/180
              </div>
            </div>

            {/* Quick romantic suggestions */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-mono tracking-widest text-stone-400 uppercase">
                Whispered Prompts:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {SUGGESTED_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => handleSelectPrompt(prompt)}
                    className="px-2.5 py-1 rounded-xl bg-stone-800/80 hover:bg-rose-950/40 hover:text-rose-200 border border-stone-700 text-[11px] text-stone-300 font-reading italic transition active:scale-95 text-left"
                  >
                    "{prompt}"
                  </button>
                ))}
              </div>
            </div>

            {/* Send Button */}
            <button
              id="submit-custom-message-button"
              type="submit"
              disabled={!message.trim() || isSending}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-rose-900/90 hover:bg-rose-800 disabled:opacity-50 text-white text-xs font-serif font-semibold tracking-wider shadow-lg shadow-rose-950/50 transition cursor-pointer border border-rose-700/50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSending ? 'DISPATCHING IN REAL TIME...' : 'DISPATCH NOTE ACROSS THE WIRE'}</span>
            </button>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
