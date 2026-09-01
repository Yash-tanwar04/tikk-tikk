import React, { useState } from 'react';
import { LoveLinkProvider, useLoveLink } from './context/LoveLinkContext';
import { AmbientBackground } from './components/AmbientBackground';
import { Navigation, TabType } from './components/Navigation';
import { HomeScreen } from './components/HomeScreen';
import { MomentsScreen } from './components/MomentsScreen';
import { SettingsScreen } from './components/SettingsScreen';
import { OnboardingFlow } from './components/OnboardingFlow';
import { SignalReceiverOverlay } from './components/SignalReceiverOverlay';

const LoveLinkMain: React.FC = () => {
  const { connection } = useLoveLink();
  const [activeTab, setActiveTab] = useState<TabType>('home');

  // Check if paired with a partner
  const isPaired = Boolean(connection && connection.status === 'paired');

  return (
    <div className="relative min-h-screen w-full bg-[#0c0a09] text-stone-100 flex flex-col font-sans overflow-x-hidden selection:bg-rose-900/40 selection:text-rose-200">
      {/* Living Atmospheric Stardust Background */}
      <AmbientBackground />

      {!isPaired ? (
        /* Onboarding & Pairing Flow */
        <OnboardingFlow />
      ) : (
        /* Main Paired Experience */
        <div className="relative z-10 flex-1 flex flex-col w-full">
          {activeTab === 'home' && <HomeScreen onNavigate={(tab) => setActiveTab(tab)} />}
          {activeTab === 'moments' && <MomentsScreen onGoHome={() => setActiveTab('home')} />}
          {activeTab === 'settings' && <SettingsScreen />}

          {/* Floating Navigation Dock */}
          <Navigation activeTab={activeTab} onTabChange={setActiveTab} />
        </div>
      )}

      {/* Real-time Fullscreen Signal Receiver Overlay */}
      <SignalReceiverOverlay />
    </div>
  );
};

export default function App() {
  return (
    <LoveLinkProvider>
      <LoveLinkMain />
    </LoveLinkProvider>
  );
}
