import React from 'react';
import { Heart, Clock, Settings } from 'lucide-react';
import { motion } from 'motion/react';
import { triggerHaptic } from '../lib/haptics';
import { useLoveLink } from '../context/LoveLinkContext';

export type TabType = 'home' | 'moments' | 'settings';

interface NavigationProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

export const Navigation: React.FC<NavigationProps> = ({ activeTab, onTabChange }) => {
  const { signals, user, settings } = useLoveLink();

  // Count unread signals received from partner
  const unreadCount = signals.filter(
    (s) => s.recipientId === user?.id && !s.readAt
  ).length;

  const handleTabClick = (tab: TabType) => {
    triggerHaptic('tap', settings.vibrationEnabled);
    onTabChange(tab);
  };

  const navItems: { id: TabType; label: string; icon: typeof Heart; badge?: number }[] = [
    { id: 'home', label: 'Sanctuary', icon: Heart },
    { id: 'moments', label: 'Chronicle', icon: Clock, badge: unreadCount },
    { id: 'settings', label: 'Settings', icon: Settings }
  ];

  return (
    <nav
      id="bottom-navigation-dock"
      aria-label="Main Navigation"
      className="fixed bottom-0 left-0 right-0 z-40 pb-safe bg-gradient-to-t from-[#0c0a09] via-[#0c0a09]/95 to-transparent backdrop-blur-lg pt-3 px-4"
    >
      <div className="max-w-md mx-auto mb-3">
        <div className="flex items-center justify-around bg-stone-900/85 border border-stone-800 rounded-2xl p-1.5 backdrop-blur-xl shadow-2xl shadow-black/80">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                id={`nav-tab-${item.id}`}
                onClick={() => handleTabClick(item.id)}
                className={`relative flex-1 flex flex-col items-center justify-center py-2.5 px-3 rounded-xl transition-all duration-200 ${
                  isActive ? 'text-rose-300 font-semibold' : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="active-pill"
                    className="absolute inset-0 bg-stone-800/80 border border-rose-500/25 rounded-xl shadow-inner"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}

                <div className="relative flex items-center justify-center">
                  <Icon
                    className={`w-5 h-5 transition-transform duration-200 ${
                      isActive ? 'scale-110 fill-rose-500/20 text-rose-300' : 'scale-100'
                    }`}
                  />
                  {item.badge && item.badge > 0 ? (
                    <span className="absolute -top-1 -right-2 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white shadow-sm ring-2 ring-stone-900">
                      {item.badge > 9 ? '9+' : item.badge}
                    </span>
                  ) : null}
                </div>

                <span className="relative mt-1 text-[10px] font-serif tracking-widest uppercase">
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};
