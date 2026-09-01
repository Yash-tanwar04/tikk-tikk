import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import {
  Heart,
  Copy,
  Check,
  Share2,
  QrCode,
  Camera,
  ArrowLeft,
  Sparkles,
  RefreshCw,
  AlertCircle,
  Upload,
  X
} from 'lucide-react';
import { useLoveLink } from '../context/LoveLinkContext';

type OnboardingStep =
  | 'welcome'
  | 'create_names'
  | 'create_waiting'
  | 'join_form'
  | 'connected_success';

export const OnboardingFlow: React.FC = () => {
  const { createConnection, joinConnection, connection, user, partner } = useLoveLink();

  const [step, setStep] = useState<OnboardingStep>('welcome');
  const [myName, setMyName] = useState('');
  const [partnerCustomName, setPartnerCustomName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [isScanningQR, setIsScanningQR] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const qrStreamRef = useRef<MediaStream | null>(null);
  const scanAnimFrameRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // If connection is already paired while on create_waiting screen, transition to success
  useEffect(() => {
    if (connection && connection.status === 'paired' && step === 'create_waiting') {
      setStep('connected_success');
    }
  }, [connection?.status, step]);

  // Render QR Code on canvas when on create_waiting step
  useEffect(() => {
    if (step === 'create_waiting' && connection?.pairingCode && canvasRef.current) {
      // Encode join URL or direct pairing code
      const joinUrl = `${window.location.origin}/?join=${connection.pairingCode}`;
      QRCode.toCanvas(canvasRef.current, joinUrl, {
        width: 190,
        margin: 1.5,
        color: {
          dark: '#ffffff',
          light: '#16111e'
        }
      }).catch((err) => console.error('QR generation error:', err));
    }
  }, [step, connection?.pairingCode]);

  // Check URL query parameters for ?join=CODE on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const joinParam = params.get('join');
    if (joinParam) {
      setJoinCode(formatPairingCode(joinParam));
      setStep('join_form');
    }
  }, []);

  const formatPairingCode = (raw: string) => {
    const cleaned = raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    if (cleaned.length > 3) {
      return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
    }
    return cleaned;
  };

  const handleScannedCode = (rawText: string) => {
    try {
      const match = rawText.match(/join=([A-Za-z0-9-]+)/i) || [null, rawText];
      const extracted = match[1] || rawText;
      const formatted = formatPairingCode(extracted);
      if (formatted.length >= 6) {
        setJoinCode(formatted);
        stopQRScanner();
        setErrorMsg(null);
      } else if (rawText.trim()) {
        setJoinCode(formatPairingCode(rawText));
        stopQRScanner();
        setErrorMsg(null);
      }
    } catch (err) {
      console.warn('Error parsing scanned QR text:', err);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = myName.trim();
    if (!cleanName) {
      setErrorMsg('Please enter your name');
      return;
    }
    setIsLoading(true);
    setErrorMsg(null);
    const result = await createConnection(cleanName, partnerCustomName.trim() || undefined);
    setIsLoading(false);
    if (result.success) {
      setStep('create_waiting');
    } else {
      setErrorMsg(result.error || 'Failed to create sanctuary. Please try again.');
    }
  };

  const handleJoinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = joinCode.trim().replace(/[^A-Z0-9-]/gi, '');
    const cleanName = myName.trim();

    if (!cleanCode || cleanCode.replace(/-/g, '').length < 6) {
      setErrorMsg('Please enter a valid 6-character connection code');
      return;
    }
    if (!cleanName) {
      setErrorMsg('Please enter your name');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    const result = await joinConnection(cleanCode, cleanName, partnerCustomName.trim() || undefined);
    setIsLoading(false);
    if (result.success) {
      setStep('connected_success');
    } else {
      setErrorMsg(result.error || 'Failed to join connection. Check code and try again.');
    }
  };

  const handleCopyCode = async () => {
    if (!connection?.pairingCode) return;
    try {
      await navigator.clipboard.writeText(connection.pairingCode);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2500);
    } catch {
      // fallback
    }
  };

  const handleShare = async () => {
    if (!connection?.pairingCode) return;
    const shareUrl = `${window.location.origin}/?join=${connection.pairingCode}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Love Link Connection',
          text: `Join me on Love Link with code: ${connection.pairingCode}`,
          url: shareUrl
        });
      } catch {
        handleCopyCode();
      }
    } else {
      handleCopyCode();
    }
  };

  // Continuous frame scanner using jsQR + BarcodeDetector fallback
  const scanVideoFrame = () => {
    if (!videoRef.current || !qrStreamRef.current) return;
    const video = videoRef.current;

    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth > 0 && video.videoHeight > 0) {
      try {
        const offscreenCanvas = document.createElement('canvas');
        offscreenCanvas.width = video.videoWidth;
        offscreenCanvas.height = video.videoHeight;
        const ctx = offscreenCanvas.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(video, 0, 0, offscreenCanvas.width, offscreenCanvas.height);
          const imageData = ctx.getImageData(0, 0, offscreenCanvas.width, offscreenCanvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'attemptBoth'
          });
          if (code && code.data) {
            handleScannedCode(code.data);
            return;
          }
        }
      } catch {
        // frame read fallback
      }
    }

    scanAnimFrameRef.current = requestAnimationFrame(scanVideoFrame);
  };

  // Camera QR Code Scanner with jsQR and BarcodeDetector
  const startQRScanner = async () => {
    setIsScanningQR(true);
    setErrorMsg(null);
    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 640 }, height: { ideal: 480 } }
        });
      } catch {
        // fallback to standard video constraint
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
      }

      qrStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        videoRef.current.play().catch(() => {});

        // Start jsQR frame scanner loop
        scanAnimFrameRef.current = requestAnimationFrame(scanVideoFrame);
      }
    } catch (err: any) {
      console.warn('Camera access note:', err);
      setErrorMsg('Camera access was not granted. You can upload an image or enter the code manually.');
      setIsScanningQR(false);
    }
  };

  const stopQRScanner = () => {
    if (scanAnimFrameRef.current) {
      cancelAnimationFrame(scanAnimFrameRef.current);
      scanAnimFrameRef.current = null;
    }
    if (qrStreamRef.current) {
      qrStreamRef.current.getTracks().forEach((track) => track.stop());
      qrStreamRef.current = null;
    }
    setIsScanningQR(false);
  };

  // Clean up camera on unmount
  useEffect(() => {
    return () => {
      stopQRScanner();
    };
  }, []);

  // Upload and decode QR code from screenshot or gallery image
  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(imageData.data, imageData.width, imageData.height, {
              inversionAttempts: 'attemptBoth'
            });
            if (code && code.data) {
              handleScannedCode(code.data);
            } else {
              setErrorMsg('No QR code detected in image. Please check or enter the 6-character code manually.');
            }
          }
        } catch {
          setErrorMsg('Could not read image file.');
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex-1 flex flex-col justify-center items-center max-w-md mx-auto w-full px-6 py-10 min-h-screen relative z-10 select-none">
      {/* 1. Welcome Screen */}
      {step === 'welcome' && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full text-center space-y-8"
        >
          {/* Logo & Icon */}
          <div className="relative flex justify-center">
            <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-rose-900/40 via-stone-800/30 to-red-950/30 p-1 flex items-center justify-center shadow-[0_0_50px_rgba(225,29,72,0.25)] animate-pulse-ring">
              <div className="w-full h-full rounded-full bg-stone-950 border border-stone-800 flex items-center justify-center text-4xl shadow-inner">
                ❤️
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-[10px] font-mono tracking-[0.25em] text-stone-400 uppercase">
              Sanctuary of Touch
            </span>
            <h1 className="text-3xl font-editorial font-bold text-stone-100 tracking-tight uppercase">
              LOVE LINK
            </h1>
            <p className="text-base text-rose-200/80 font-reading italic">
              Two phones. One shared heartbeat.
            </p>
            <p className="text-xs text-stone-400 font-reading max-w-xs mx-auto leading-relaxed">
              Whenever you press your medallion, your partner's phone vibrates and resonates with intimate real-time warmth.
            </p>
          </div>

          {/* Buttons */}
          <div className="space-y-3 pt-4 w-full max-w-xs mx-auto">
            <motion.button
              id="start-create-connection-button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => {
                setErrorMsg(null);
                setStep('create_names');
              }}
              className="w-full py-3.5 px-6 rounded-2xl bg-rose-900/90 hover:bg-rose-800 text-white font-serif font-semibold text-xs tracking-wider shadow-xl shadow-rose-950/50 transition cursor-pointer border border-rose-700/50"
            >
              CREATE SANCTUARY
            </motion.button>

            <motion.button
              id="start-join-connection-button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => {
                setErrorMsg(null);
                setStep('join_form');
              }}
              className="w-full py-3.5 px-6 rounded-2xl bg-stone-900 hover:bg-stone-800 border border-stone-800 text-stone-200 font-serif font-semibold text-xs tracking-wider transition cursor-pointer shadow-sm"
            >
              JOIN SANCTUARY
            </motion.button>
          </div>
        </motion.div>
      )}

      {/* 2. Create Connection — Name Setup */}
      {step === 'create_names' && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="w-full max-w-sm space-y-6"
        >
          <button
            onClick={() => setStep('welcome')}
            className="flex items-center gap-1.5 text-xs text-stone-400 hover:text-stone-200 font-serif cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>

          <div className="text-center space-y-1">
            <div className="text-3xl mb-2">✨</div>
            <h2 className="text-2xl font-editorial font-bold text-stone-100 tracking-tight">
              Create Your Sanctuary
            </h2>
            <p className="text-xs text-stone-400 font-reading italic">
              Inscribe your names to begin
            </p>
          </div>

          <form onSubmit={handleCreateSubmit} noValidate={false} className="space-y-4 pt-2">
            <div>
              <label htmlFor="create-my-name" className="block text-xs font-medium text-stone-400 mb-1.5 font-reading">
                Your Inscription (Name)
              </label>
              <input
                id="create-my-name"
                type="text"
                required
                maxLength={24}
                value={myName}
                onChange={(e) => {
                  setMyName(e.target.value);
                  if (errorMsg) setErrorMsg(null);
                }}
                placeholder="e.g. Yash"
                className="w-full px-4 py-3 rounded-2xl bg-stone-950 border border-stone-800 text-sm text-stone-100 placeholder-stone-600 focus:outline-none focus:border-rose-500/50"
                autoFocus
              />
            </div>

            <div>
              <label htmlFor="create-partner-name" className="block text-xs font-medium text-stone-400 mb-1.5 font-reading">
                Partner's Display Inscription
              </label>
              <input
                id="create-partner-name"
                type="text"
                maxLength={24}
                value={partnerCustomName}
                onChange={(e) => setPartnerCustomName(e.target.value)}
                placeholder="e.g. Her / My Love"
                className="w-full px-4 py-3 rounded-2xl bg-stone-950 border border-stone-800 text-sm text-stone-100 placeholder-stone-600 focus:outline-none focus:border-rose-500/50"
              />
            </div>

            {errorMsg && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-red-950/40 border border-red-800/40 text-red-300 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <button
              id="submit-create-connection-form"
              type="submit"
              disabled={isLoading || !myName.trim()}
              className="w-full py-3.5 px-6 rounded-2xl bg-rose-900/90 hover:bg-rose-800 disabled:opacity-50 text-white font-serif font-semibold text-xs tracking-wider shadow-xl shadow-rose-950/50 transition cursor-pointer border border-rose-700/50"
            >
              {isLoading ? 'ESTABLISHING SANCTUARY...' : 'CONTINUE'}
            </button>
          </form>
        </motion.div>
      )}

      {/* 3. Waiting for Partner to Pair */}
      {step === 'create_waiting' && connection && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-sm text-center space-y-6"
        >
          <div className="space-y-1">
            <span className="text-[10px] font-mono tracking-[0.2em] text-stone-400 uppercase">
              Sanctuary Pairing Code
            </span>
            <h2 className="text-3xl sm:text-4xl font-mono font-extrabold text-stone-100 tracking-widest bg-stone-950 py-2.5 px-4 rounded-2xl border border-stone-800 shadow-lg inline-block">
              {connection.pairingCode}
            </h2>
          </div>

          {/* QR Code Canvas */}
          <div className="p-4 rounded-3xl bg-stone-900 border border-stone-800 shadow-2xl inline-block">
            <canvas ref={canvasRef} className="rounded-2xl mx-auto shadow-inner" />
            <p className="text-[11px] text-stone-400 mt-2 font-reading italic">
              Scan with mobile camera to link
            </p>
          </div>

          <p className="text-xs text-stone-300 font-reading italic">
            Share this code or QR code with your person.
          </p>

          {/* Action Buttons */}
          <div className="space-y-2 max-w-xs mx-auto">
            <button
              id="copy-pairing-code-button"
              onClick={handleCopyCode}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-stone-900 hover:bg-stone-800 border border-stone-800 text-xs font-serif font-semibold tracking-wider text-stone-200 transition active:scale-98 cursor-pointer"
            >
              {isCopied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-300">Inscribed ✓</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-stone-400" />
                  <span>COPY PAIRING CODE</span>
                </>
              )}
            </button>

            <button
              id="share-pairing-link-button"
              onClick={handleShare}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-rose-950/40 hover:bg-rose-900/50 border border-rose-500/30 text-xs font-serif font-semibold tracking-wider text-rose-300 transition cursor-pointer"
            >
              <Share2 className="w-4 h-4" />
              <span>TRANSMIT LINK</span>
            </button>
          </div>

          {/* Real-time waiting indicator */}
          <div className="flex items-center justify-center gap-2 pt-2 text-xs text-stone-400 font-reading italic">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-rose-400" />
            <span>Awaiting partner connection across the wire...</span>
          </div>
        </motion.div>
      )}

      {/* 4. Join Connection Form */}
      {step === 'join_form' && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="w-full max-w-sm space-y-6"
        >
          <button
            onClick={() => {
              stopQRScanner();
              setStep('welcome');
            }}
            className="flex items-center gap-1.5 text-xs text-stone-400 hover:text-stone-200 font-serif cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>

          <div className="text-center space-y-1">
            <div className="text-3xl mb-2">🔗</div>
            <h2 className="text-2xl font-editorial font-bold text-stone-100 tracking-tight">
              Join Sanctuary
            </h2>
            <p className="text-xs text-stone-400 font-reading italic">
              Enter the 6-character code from your person
            </p>
          </div>

          {/* Hidden File Input for Image QR upload */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageFileChange}
          />

          {/* QR Scanner view if active */}
          {isScanningQR ? (
            <div className="space-y-3">
              <div className="relative w-full aspect-square rounded-3xl overflow-hidden bg-black border-2 border-rose-500/50 shadow-2xl flex items-center justify-center">
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-8 border-2 border-dashed border-rose-400/80 rounded-2xl pointer-events-none animate-pulse" />
                <div className="absolute top-3 right-3">
                  <button
                    onClick={stopQRScanner}
                    className="p-2 rounded-full bg-stone-900/80 text-stone-200 hover:text-white border border-stone-700 backdrop-blur-md cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="absolute bottom-3 inset-x-3 text-center">
                  <span className="text-[11px] font-mono px-3 py-1 rounded-full bg-stone-950/80 border border-stone-800 text-stone-300 backdrop-blur-md">
                    Align QR code within frame
                  </span>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-stone-900 border border-stone-800 text-xs font-serif font-semibold text-stone-300 hover:bg-stone-800 transition cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload QR Image</span>
                </button>
                <button
                  type="button"
                  onClick={stopQRScanner}
                  className="px-4 py-2.5 rounded-xl bg-stone-900 border border-stone-800 text-xs font-serif font-semibold text-stone-300 hover:bg-stone-800 transition cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleJoinSubmit} noValidate={false} className="space-y-4 pt-1">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="join-code-input" className="text-xs font-medium text-stone-400 font-reading">
                    Sanctuary Code
                  </label>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={startQRScanner}
                      className="flex items-center gap-1 text-[11px] text-rose-400 hover:text-rose-300 font-serif cursor-pointer"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>Camera</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-1 text-[11px] text-stone-400 hover:text-stone-300 font-serif cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Image</span>
                    </button>
                  </div>
                </div>

                <input
                  id="join-code-input"
                  type="text"
                  required
                  maxLength={7}
                  value={joinCode}
                  onChange={(e) => {
                    setJoinCode(formatPairingCode(e.target.value));
                    if (errorMsg) setErrorMsg(null);
                  }}
                  placeholder="e.g. 7KQ-29M"
                  className="w-full px-4 py-3.5 rounded-2xl bg-stone-950 border border-stone-800 text-base font-mono tracking-widest text-center text-stone-100 placeholder-stone-700 focus:outline-none focus:border-rose-500/50 uppercase"
                  autoFocus
                />
              </div>

              <div>
                <label htmlFor="join-my-name" className="block text-xs font-medium text-stone-400 mb-1.5 font-reading">
                  Your Inscription (Name)
                </label>
                <input
                  id="join-my-name"
                  type="text"
                  required
                  maxLength={24}
                  value={myName}
                  onChange={(e) => {
                    setMyName(e.target.value);
                    if (errorMsg) setErrorMsg(null);
                  }}
                  placeholder="e.g. Her / Yash"
                  className="w-full px-4 py-3 rounded-2xl bg-stone-950 border border-stone-800 text-sm text-stone-100 placeholder-stone-600 focus:outline-none focus:border-rose-500/50"
                />
              </div>

              <div>
                <label htmlFor="join-partner-name" className="block text-xs font-medium text-stone-400 mb-1.5 font-reading">
                  Partner's Display Inscription
                </label>
                <input
                  id="join-partner-name"
                  type="text"
                  maxLength={24}
                  value={partnerCustomName}
                  onChange={(e) => setPartnerCustomName(e.target.value)}
                  placeholder="e.g. My Love / Him"
                  className="w-full px-4 py-3 rounded-2xl bg-stone-950 border border-stone-800 text-sm text-stone-100 placeholder-stone-600 focus:outline-none focus:border-rose-500/50"
                />
              </div>

              {errorMsg && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-red-950/40 border border-red-800/40 text-red-300 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <button
                id="submit-join-connection-form"
                type="submit"
                disabled={isLoading || !joinCode.trim() || !myName.trim()}
                className="w-full py-3.5 px-6 rounded-2xl bg-rose-900/90 hover:bg-rose-800 disabled:opacity-50 text-white font-serif font-semibold text-xs tracking-wider shadow-xl shadow-rose-950/50 transition cursor-pointer border border-rose-700/50"
              >
                {isLoading ? 'CONNECTING...' : 'ENTER SANCTUARY'}
              </button>
            </form>
          )}
        </motion.div>
      )}

      {/* 5. Connected Success Screen */}
      {step === 'connected_success' && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', damping: 20 }}
          className="w-full max-w-sm text-center space-y-6"
        >
          <div className="flex items-center justify-center gap-2 text-rose-400">
            <Sparkles className="w-5 h-5 animate-pulse" />
            <span className="text-xs font-mono font-bold tracking-[0.25em] uppercase">SYNCHRONIZED</span>
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>

          <div className="w-24 h-24 rounded-full bg-rose-950/30 border border-rose-500/30 flex items-center justify-center text-5xl mx-auto shadow-[0_0_60px_rgba(225,29,72,0.35)] animate-breathe">
            ❤️
          </div>

          <div className="space-y-1">
            <h2 className="text-2xl font-editorial font-bold text-stone-100 tracking-tight">
              You + Your Person
            </h2>
            <p className="text-xs text-rose-200/80 font-reading italic">
              Connected in private sanctuary
            </p>
          </div>

          <p className="text-xs text-stone-400 font-reading leading-relaxed max-w-xs mx-auto">
            Your devices are now synchronized across the wire. Whenever either of you touches the medallion, the other will feel it instantly.
          </p>

          <button
            id="continue-to-home-button"
            onClick={() => {
              window.location.reload();
            }}
            className="w-full max-w-xs mx-auto py-3.5 px-6 rounded-2xl bg-rose-900/90 hover:bg-rose-800 text-white font-serif font-semibold text-xs tracking-wider shadow-xl shadow-rose-950/50 transition cursor-pointer border border-rose-700/50"
          >
            ENTER CHRONICLE
          </button>
        </motion.div>
      )}
    </div>
  );
};

