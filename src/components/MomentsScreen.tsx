import React from 'react';
import { motion } from 'motion/react';
import { CheckCheck, Check, Clock, Heart, Sparkles } from 'lucide-react';
import { useLoveLink } from '../context/LoveLinkContext';
import { SIGNAL_CONFIGS } from './SignalConfigs';
import { Signal } from '../types';

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function groupSignalsByDay(signals: Signal[]): { dateLabel: string; items: Signal[] }[] {
  const groups: Record<string, Signal[]> = {};
  const todayStr = new Date().toDateString();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toDateString();

  signals.forEach((sig) => {
    const d = new Date(sig.createdAt);
    const dateStr = d.toDateString();
    let label = '';

    if (dateStr === todayStr) {
      label = 'TODAY';
    } else if (dateStr === yesterdayStr) {
      label = 'YESTERDAY';
    } else {
      label = d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase();
    }

    if (!groups[label]) {
      groups[label] = [];
    }
    groups[label].push(sig);
  });

  return Object.keys(groups).map((dateLabel) => ({
    dateLabel,
    items: groups[dateLabel]
  }));
}

interface MomentsScreenProps {
  onGoHome: () => void;
}

export const MomentsScreen: React.FC<MomentsScreenProps> = ({ onGoHome }) => {
  const { signals, user, partnerDisplayName } = useLoveLink();

  const grouped = groupSignalsByDay(signals);

  return (
    <div className="flex-1 flex flex-col max-w-md mx-auto w-full px-5 pt-safe pb-28 min-h-screen relative z-10 select-none">
      {/* Header */}
      <header className="pt-4 pb-3 flex items-center justify-between border-b border-stone-800">
        <div>
          <span className="text-[10px] font-mono tracking-[0.2em] text-stone-400 uppercase">
            Shared Chronicle
          </span>
          <h1 className="text-2xl font-editorial font-bold text-stone-100 tracking-tight flex items-center gap-2">
            <span>Moments</span>
            <span className="text-xs font-normal text-stone-400 font-reading italic">
              ({signals.length} {signals.length === 1 ? 'signal' : 'signals'} recorded)
            </span>
          </h1>
        </div>
        <div className="p-2 rounded-xl bg-stone-900 border border-stone-800 text-stone-300 shadow-sm">
          <Clock className="w-4 h-4 text-rose-400" />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 mt-4">
        {signals.length === 0 ? (
          /* Empty State */
          <div className="h-full min-h-[380px] flex flex-col items-center justify-center text-center p-8 rounded-3xl bg-stone-900/70 border border-stone-800 backdrop-blur-md my-8 shadow-xl">
            <div className="w-16 h-16 rounded-full bg-rose-950/40 border border-rose-500/30 flex items-center justify-center text-3xl mb-4 text-rose-300 animate-breathe">
              💌
            </div>
            <h3 className="text-lg font-editorial font-bold text-stone-100">
              An Empty Page in Your Chronicle
            </h3>
            <p className="text-xs text-stone-400 font-reading italic max-w-xs mt-2 leading-relaxed">
              Every touch, hug, and little signal you exchange will appear here as a private memory between the two of you.
            </p>
            <button
              id="empty-state-send-love-button"
              onClick={onGoHome}
              className="mt-6 flex items-center gap-2 px-6 py-2.5 rounded-xl bg-rose-950/40 hover:bg-rose-900/50 border border-rose-500/30 text-rose-200 text-xs font-serif tracking-wider font-semibold transition shadow-sm"
            >
              <Heart className="w-3.5 h-3.5 fill-rose-300 text-rose-300" />
              <span>SEND FIRST SIGNAL</span>
            </button>
          </div>
        ) : (
          /* Grouped Timeline */
          <div className="space-y-6">
            {grouped.map((group, groupIdx) => (
              <div key={group.dateLabel} className="space-y-2.5">
                {/* Date Label Header */}
                <div className="flex items-center gap-2 pt-2">
                  <span className="text-[10px] font-mono tracking-widest text-stone-400 uppercase">
                    {group.dateLabel}
                  </span>
                  <div className="flex-1 h-px bg-stone-800" />
                </div>

                {/* Timeline Items */}
                <div className="space-y-2.5">
                  {group.items.map((sig, idx) => {
                    const isMe = sig.senderId === user?.id;
                    const cfg = SIGNAL_CONFIGS[sig.type] || SIGNAL_CONFIGS.love;

                    return (
                      <motion.div
                        key={sig.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.03 }}
                        className={`p-4 rounded-2xl border backdrop-blur-md flex items-start gap-3.5 transition-colors shadow-sm ${
                          isMe
                            ? 'bg-stone-900/85 border-stone-800'
                            : 'bg-rose-950/30 border-rose-900/40'
                        }`}
                      >
                        {/* Signal Icon Circle */}
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 shadow-sm border border-white/5"
                          style={{
                            backgroundColor: isMe ? 'rgba(255,255,255,0.04)' : cfg.glowColor
                          }}
                        >
                          {cfg.icon}
                        </div>

                        {/* Details */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-xs font-editorial font-semibold text-stone-200 truncate">
                              {isMe ? `${cfg.label} transmitted` : `${partnerDisplayName} ${cfg.verb}`}
                            </span>
                            <span className="text-[10px] text-stone-400 font-mono shrink-0">
                              {formatTime(sig.createdAt)}
                            </span>
                          </div>

                          {/* Message Note if present */}
                          {sig.message ? (
                            <div className="mt-2 p-3 rounded-xl bg-stone-950/70 border border-stone-800/80">
                              <p className="text-xs text-stone-200 font-reading italic leading-relaxed">
                                "{sig.message}"
                              </p>
                            </div>
                          ) : (
                            <p className="text-[11px] text-stone-400 mt-0.5 font-reading italic">
                              {isMe ? 'Delivered across the wire' : cfg.receivedSubtext}
                            </p>
                          )}

                          {/* Read receipt */}
                          {isMe && (
                            <div className="flex items-center gap-1 mt-2 text-[10px] font-mono text-stone-400">
                              {sig.readAt ? (
                                <>
                                  <CheckCheck className="w-3 h-3 text-rose-400" />
                                  <span className="text-rose-300/90">Acknowledged</span>
                                </>
                              ) : (
                                <>
                                  <Check className="w-3 h-3 text-stone-400" />
                                  <span>Delivered</span>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};
