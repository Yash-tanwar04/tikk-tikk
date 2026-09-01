import React, { useEffect, useState } from 'react';
import { Download, Share2, PlusSquare, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export const PWAInstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check if running in standalone mode (already installed PWA)
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    setIsInstalled(isStandalone);

    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIOSDevice);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  if (isInstalled || dismissed) {
    return null;
  }

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
    } else if (isIOS) {
      setShowIOSGuide(true);
    }
  };

  return (
    <>
      <div
        id="pwa-install-banner"
        className="p-3.5 rounded-2xl bg-stone-900 border border-stone-800 backdrop-blur-xl relative shadow-sm"
      >
        <button
          id="dismiss-pwa-banner-button"
          onClick={() => setDismissed(true)}
          className="absolute top-3 right-3 text-stone-400 hover:text-stone-200"
          aria-label="Dismiss installation prompt"
        >
          <X className="w-3.5 h-3.5" />
        </button>

        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-rose-950/40 border border-rose-500/30 flex items-center justify-center text-rose-300 shrink-0 mt-0.5">
            <Download className="w-4 h-4" />
          </div>

          <div className="flex-1 pr-4">
            <h4 className="text-xs font-editorial font-semibold text-stone-100">
              Install Sanctuary to Home Screen ❤️
            </h4>
            <p className="text-[11px] text-stone-400 font-reading italic mt-0.5 leading-tight">
              Keep the heartbeat close at hand so your partner's signals resonate instantly.
            </p>

            <button
              id="install-pwa-button"
              onClick={handleInstallClick}
              className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-900/90 hover:bg-rose-800 text-white text-[11px] font-serif font-semibold tracking-wider transition shadow-sm border border-rose-700/50"
            >
              <Download className="w-3 h-3" />
              <span>{isIOS ? 'Install on iPhone / iPad' : 'INSTALL PWA'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* iOS Safari Step-by-Step Modal */}
      {showIOSGuide && (
        <div
          id="ios-install-guide-modal"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
        >
          <div className="w-full max-w-sm rounded-3xl bg-stone-900 border border-stone-800 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <h3 className="text-base font-editorial font-bold text-stone-100 flex items-center gap-2">
                <span>Install on iOS Safari</span>
                <span>📲</span>
              </h3>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="text-stone-400 hover:text-stone-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-stone-300">
              <div className="flex items-start gap-3 p-3 rounded-xl bg-stone-950 border border-stone-800">
                <div className="p-1.5 rounded-lg bg-rose-950/40 border border-rose-500/20 text-rose-300">
                  <Share2 className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-editorial font-semibold text-stone-100">1. Tap the Share button</span>
                  <p className="text-stone-400 font-reading italic mt-0.5">Located at the bottom toolbar in Safari.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-stone-950 border border-stone-800">
                <div className="p-1.5 rounded-lg bg-stone-800 border border-stone-700 text-rose-300">
                  <PlusSquare className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-editorial font-semibold text-stone-100">2. Tap "Add to Home Screen"</span>
                  <p className="text-stone-400 font-reading italic mt-0.5">Scroll down in the share menu and select it.</p>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowIOSGuide(false)}
              className="w-full py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-serif font-semibold tracking-wider transition border border-stone-700"
            >
              UNDERSTOOD
            </button>
          </div>
        </div>
      )}
    </>
  );
};
