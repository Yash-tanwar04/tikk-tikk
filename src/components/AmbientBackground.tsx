import React, { useEffect, useRef } from 'react';
import { useLoveLink } from '../context/LoveLinkContext';

interface Particle {
  x: number;
  y: number;
  size: number;
  speedX: number;
  speedY: number;
  opacity: number;
  fadeSpeed: number;
}

export const AmbientBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { settings, activeIncomingSignal } = useLoveLink();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || settings.reducedMotion) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);

    // Initialize 24 subtle floating warm stardust motes
    const particleCount = 24;
    const particles: Particle[] = [];
    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.random() * 1.6 + 0.6,
        speedX: (Math.random() - 0.5) * 0.2,
        speedY: -Math.random() * 0.25 - 0.08,
        opacity: Math.random() * 0.4 + 0.1,
        fadeSpeed: (Math.random() * 0.006 + 0.002) * (Math.random() > 0.5 ? 1 : -1)
      });
    }

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Draw motes
      particles.forEach((p) => {
        p.x += p.speedX;
        p.y += p.speedY;
        p.opacity += p.fadeSpeed;

        if (p.opacity > 0.55) {
          p.opacity = 0.55;
          p.fadeSpeed = -Math.abs(p.fadeSpeed);
        } else if (p.opacity < 0.05) {
          p.opacity = 0.05;
          p.fadeSpeed = Math.abs(p.fadeSpeed);
        }

        // Wrap around screen
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;
        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(245, 235, 230, ${p.opacity})`;
        ctx.shadowBlur = 3;
        ctx.shadowColor = 'rgba(230, 200, 190, 0.3)';
        ctx.fill();
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [settings.reducedMotion]);

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden="true">
      {/* Editorial Deep Stone & Charcoal background */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#0c0a09] via-[#141011] to-[#0c0a09]" />

      {/* Subtle Editorial Top Halo */}
      <div
        className="absolute -top-32 left-1/2 -translate-x-1/2 w-[550px] h-[450px] rounded-full blur-[140px] transition-colors duration-1000 opacity-20"
        style={{
          backgroundColor: activeIncomingSignal ? '#e11d48' : '#881337'
        }}
      />

      {/* Center Warm Hearth Light */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[360px] h-[360px] rounded-full blur-[120px] transition-all duration-1000 opacity-20 animate-breathe"
        style={{
          backgroundColor: activeIncomingSignal ? '#f43f5e' : '#be123c'
        }}
      />

      {/* Stardust particle canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
    </div>
  );
};
