import React, { useState } from 'react';
import {
  Bell,
  BellRing,
  Volume2,
  VolumeX,
  Smartphone,
  Sliders,
  Shield,
  Heart,
  LogOut,
  Check,
  Sparkles,
  Download,
  AlertTriangle
} from 'lucide-react';
import { useLoveLink } from '../context/LoveLinkContext';
import { playSignalSound } from '../lib/audio';
import { triggerHaptic } from '../lib/haptics';
import { PWAInstallPrompt } from './PWAInstallPrompt';

export const SettingsScreen: React.FC = () => {
  const {
    user,
    partner,
    partnerDisplayName,
    connection,
    settings,
    updateSettings,
    pushStatus,
    isPushSubscribed,
    requestPushPermission,
    sendTestPush,
    updateNames,
    disconnect
  } = useLoveLink();

  const [myName, setMyName] = useState(user?.name || '');
  const [partnerCustomName, setPartnerCustomName] = useState(user?.customPartnerName || '');
  const [nameSaved, setNameSaved] = useState(false);
  const [isTestPushing, setIsTestPushing] = useState(false);
  const [testPushFeedback, setTestPushFeedback] = useState<string | null>(null);
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);

  const handleSaveNames = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!myName.trim()) return;
    await updateNames(myName.trim(), partnerCustomName.trim());
    setNameSaved(true);
    setTimeout(() => setNameSaved(false), 2000);
  };

  const handleEnablePush = async () => {
    const success = await requestPushPermission();
    if (success) {
      setTestPushFeedback('Notifications enabled! ❤️');
      setTimeout(() => setTestPushFeedback(null), 3000);
    }
  };

  const handleTestPush = async () => {
    setIsTestPushing(true);
    setTestPushFeedback(null);
    const success = await sendTestPush();
    setIsTestPushing(false);
    if (success) {
      setTestPushFeedback('Test push sent! Lock your screen or switch apps to verify.');
    } else {
      setTestPushFeedback('Could not send test push. Please make sure notifications are allowed.');
    }
    setTimeout(() => setTestPushFeedback(null), 5000);
  };

  const testAudioTone = (type: string) => {
    playSignalSound(type, true);
    triggerHaptic(type, true);
  };

  const pairedDate = connection?.pairedAt
    ? new Date(connection.pairedAt).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })
    : 'Recently';

  return (
    <div className="flex-1 flex flex-col max-w-md mx-auto w-full px-5 pt-safe pb-28 min-h-screen relative z-10 select-none">
      {/* Header */}
      <header className="pt-4 pb-3 flex items-center justify-between border-b border-stone-800">
        <div>
          <span className="text-[10px] font-mono tracking-[0.2em] text-stone-400 uppercase">
            Preferences & Sanctuary
          </span>
          <h1 className="text-2xl font-editorial font-bold text-stone-100 tracking-tight">
            Settings
          </h1>
        </div>
      </header>

      {/* Main Settings Sections */}
      <main className="mt-5 space-y-5">
        {/* PWA Install Banner if applicable */}
        <PWAInstallPrompt />

        {/* 1. Notifications Section */}
        <section className="p-4 rounded-3xl bg-stone-900/85 border border-stone-800 backdrop-blur-xl space-y-3.5 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-rose-950/40 border border-rose-500/20 text-rose-400">
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-editorial font-semibold text-stone-100">
                  Background Push Dispatches
                </h3>
                <p className="text-[11px] text-stone-400 font-reading italic">
                  Receive physical signals even when screen is locked
                </p>
              </div>
            </div>

            {/* Status Badge */}
            <span
              className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                pushStatus === 'granted'
                  ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/30'
                  : pushStatus === 'denied'
                  ? 'bg-red-950/60 text-red-300 border border-red-500/30'
                  : 'bg-stone-800 text-stone-400 border border-stone-700'
              }`}
            >
              {pushStatus === 'granted' ? 'Active' : pushStatus === 'denied' ? 'Blocked' : 'Off'}
            </span>
          </div>

          {pushStatus !== 'granted' ? (
            <div className="pt-2">
              <button
                id="enable-push-button"
                onClick={handleEnablePush}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-rose-900/80 hover:bg-rose-800 text-white text-xs font-serif font-semibold tracking-wider shadow-md shadow-rose-950/40 transition border border-rose-700/50"
              >
                <BellRing className="w-3.5 h-3.5" />
                <span>ENABLE WEB PUSH NOTIFICATIONS</span>
              </button>
              {pushStatus === 'denied' && (
                <p className="text-[10px] text-amber-400/90 mt-2 text-center font-reading italic">
                  Notifications are restricted in browser settings. Please permit notifications for this site to receive background heartbeats.
                </p>
              )}
            </div>
          ) : (
            <div className="pt-1 space-y-2">
              <button
                id="test-push-button"
                disabled={isTestPushing}
                onClick={handleTestPush}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-stone-800/80 hover:bg-stone-700/80 border border-stone-700 text-xs font-mono text-stone-200 transition"
              >
                <Smartphone className="w-3.5 h-3.5 text-rose-400" />
                <span>{isTestPushing ? 'Transmitting test push...' : 'Transmit Test Background Push'}</span>
              </button>
            </div>
          )}

          {testPushFeedback && (
            <p className="text-[11px] text-emerald-400 text-center font-reading italic pt-1">
              {testPushFeedback}
            </p>
          )}
        </section>

        {/* 2. Sound & Haptics Preferences */}
        <section className="p-4 rounded-3xl bg-stone-900/85 border border-stone-800 backdrop-blur-xl space-y-4 shadow-sm">
          <div className="flex items-center gap-2.5 border-b border-stone-800 pb-2">
            <Sliders className="w-4 h-4 text-rose-400" />
            <h3 className="text-sm font-editorial font-semibold text-stone-100">
              Acoustic & Tactile Sensations
            </h3>
          </div>

          {/* Sound Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {settings.soundEnabled ? (
                <Volume2 className="w-4 h-4 text-rose-400" />
              ) : (
                <VolumeX className="w-4 h-4 text-stone-500" />
              )}
              <div>
                <div className="text-xs font-editorial font-semibold text-stone-200">Harmonic Chimes</div>
                <div className="text-[11px] text-stone-400 font-reading italic">Pure harmonic sine waves</div>
              </div>
            </div>

            <button
              id="toggle-sound-button"
              aria-label="Toggle sound"
              onClick={() => updateSettings({ soundEnabled: !settings.soundEnabled })}
              className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                settings.soundEnabled ? 'bg-rose-700' : 'bg-stone-700'
              }`}
            >
              <div
                className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                  settings.soundEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Sound Preview Row */}
          {settings.soundEnabled && (
            <div className="pt-1 flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] text-stone-400 mr-1 font-mono">Sample:</span>
              {[
                { type: 'love', label: '❤️ Love' },
                { type: 'hug', label: '🫂 Hug' },
                { type: 'kiss', label: '💋 Kiss' },
                { type: 'miss_you', label: '🥺 Miss' },
                { type: 'call_me', label: '📞 Call' }
              ].map((item) => (
                <button
                  key={item.type}
                  id={`preview-sound-${item.type}`}
                  onClick={() => testAudioTone(item.type)}
                  className="px-2 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-[10px] text-stone-300 border border-stone-700 transition active:scale-95 font-reading"
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}

          {/* Vibration Toggle */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-3">
              <Smartphone className="w-4 h-4 text-rose-400" />
              <div>
                <div className="text-xs font-editorial font-semibold text-stone-200">Haptic Heartbeats</div>
                <div className="text-[11px] text-stone-400 font-reading italic">Physical vibrations on device</div>
              </div>
            </div>

            <button
              id="toggle-vibration-button"
              aria-label="Toggle vibration"
              onClick={() => updateSettings({ vibrationEnabled: !settings.vibrationEnabled })}
              className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                settings.vibrationEnabled ? 'bg-rose-700' : 'bg-stone-700'
              }`}
            >
              <div
                className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                  settings.vibrationEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Reduced Motion */}
          <div className="flex items-center justify-between pt-1">
            <div>
              <div className="text-xs font-editorial font-semibold text-stone-200">Subdued Motion</div>
              <div className="text-[11px] text-stone-400 font-reading italic">Minimalist visual transitions</div>
            </div>

            <button
              id="toggle-reduced-motion-button"
              aria-label="Toggle reduced motion"
              onClick={() => updateSettings({ reducedMotion: !settings.reducedMotion })}
              className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                settings.reducedMotion ? 'bg-rose-700' : 'bg-stone-700'
              }`}
            >
              <div
                className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                  settings.reducedMotion ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </section>

        {/* 3. User Identity & Partner Names */}
        <section className="p-4 rounded-3xl bg-stone-900/85 border border-stone-800 backdrop-blur-xl space-y-3 shadow-sm">
          <div className="flex items-center gap-2.5 border-b border-stone-800 pb-2">
            <Heart className="w-4 h-4 text-rose-400" />
            <h3 className="text-sm font-editorial font-semibold text-stone-100">
              Inscriptions & Names
            </h3>
          </div>

          <form onSubmit={handleSaveNames} className="space-y-3 pt-1">
            <div>
              <label htmlFor="settings-my-name" className="block text-[11px] font-medium text-stone-400 mb-1">
                Your Inscription (Name)
              </label>
              <input
                id="settings-my-name"
                type="text"
                value={myName}
                onChange={(e) => setMyName(e.target.value)}
                maxLength={24}
                className="w-full px-3.5 py-2.5 rounded-xl bg-stone-950 border border-stone-800 text-xs text-stone-100 placeholder-stone-600 focus:outline-none focus:border-rose-500/50"
                placeholder="e.g. Yash"
              />
            </div>

            <div>
              <label htmlFor="settings-partner-name" className="block text-[11px] font-medium text-stone-400 mb-1">
                Partner's Display Inscription
              </label>
              <input
                id="settings-partner-name"
                type="text"
                value={partnerCustomName}
                onChange={(e) => setPartnerCustomName(e.target.value)}
                maxLength={24}
                className="w-full px-3.5 py-2.5 rounded-xl bg-stone-950 border border-stone-800 text-xs text-stone-100 placeholder-stone-600 focus:outline-none focus:border-rose-500/50"
                placeholder="e.g. Her / My Person"
              />
            </div>

            <button
              id="save-names-button"
              type="submit"
              className="w-full flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl bg-stone-800 hover:bg-stone-700 text-xs font-serif font-semibold tracking-wider text-stone-100 transition active:scale-[0.99] border border-stone-700"
            >
              {nameSaved ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-300">Inscriptions Saved</span>
                </>
              ) : (
                <span>SAVE CHANGES</span>
              )}
            </button>
          </form>
        </section>

        {/* 4. Connection Details & Disconnect */}
        <section className="p-4 rounded-3xl bg-stone-900/85 border border-stone-800 backdrop-blur-xl space-y-3 shadow-sm">
          <div className="flex items-center gap-2.5 border-b border-stone-800 pb-2">
            <Shield className="w-4 h-4 text-rose-400" />
            <h3 className="text-sm font-editorial font-semibold text-stone-100">
              Private Connection Room
            </h3>
          </div>

          <div className="space-y-2 text-xs pt-1">
            <div className="flex items-center justify-between text-stone-300">
              <span className="text-stone-400 font-reading">Connected with:</span>
              <span className="font-editorial font-semibold text-stone-100">{partnerDisplayName}</span>
            </div>

            <div className="flex items-center justify-between text-stone-300">
              <span className="text-stone-400 font-reading">Connection ID:</span>
              <span className="font-mono text-[11px] text-stone-300">{connection?.id}</span>
            </div>

            <div className="flex items-center justify-between text-stone-300">
              <span className="text-stone-400 font-reading">Established:</span>
              <span className="text-stone-300 font-reading italic">{pairedDate}</span>
            </div>
          </div>

          <div className="pt-2">
            <button
              id="open-disconnect-modal-button"
              onClick={() => setShowDisconnectModal(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-red-950/30 hover:bg-red-950/50 border border-red-900/40 text-red-300 text-xs font-serif tracking-wider transition"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>DISCONNECT SANCTUARY</span>
            </button>
          </div>
        </section>

        {/* Footer info */}
        <footer className="text-center pt-2 pb-6 space-y-1">
          <div className="flex items-center justify-center gap-1.5 text-xs font-reading italic text-stone-400">
            <span>Love Link Chronicle</span>
            <span>•</span>
            <span>Made for two ❤️</span>
          </div>
          <p className="text-[10px] font-mono text-stone-500">
            End-to-end private socket connection
          </p>
        </footer>
      </main>

      {/* Disconnect Confirmation Modal */}
      {showDisconnectModal && (
        <div
          id="disconnect-confirmation-modal"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
        >
          <div className="w-full max-w-sm rounded-3xl bg-stone-900 border border-stone-800 p-6 shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-red-950/40 border border-red-800/40 text-red-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-base font-editorial font-bold text-stone-100">
                Disconnect Love Link Sanctuary?
              </h3>
              <p className="text-xs text-stone-400 font-reading italic mt-1.5 leading-relaxed">
                This will unpair your device from <span className="text-stone-200 font-semibold">{partnerDisplayName}</span>. You can establish a new private connection anytime.
              </p>
            </div>

            <div className="space-y-2 pt-2">
              <button
                id="confirm-disconnect-button"
                onClick={disconnect}
                className="w-full py-2.5 px-4 rounded-xl bg-red-800 hover:bg-red-700 text-white text-xs font-serif font-semibold tracking-wider shadow-lg shadow-red-950/50 transition"
              >
                YES, DISCONNECT
              </button>

              <button
                id="cancel-disconnect-button"
                onClick={() => setShowDisconnectModal(false)}
                className="w-full py-2.5 px-4 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
