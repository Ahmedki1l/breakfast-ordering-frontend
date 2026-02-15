import React, { useState, useEffect, useRef } from 'react';

export default function CountdownTimer({ deadline, onExpired }) {
  const [timeLeft, setTimeLeft] = useState(getTimeLeft(deadline));
  const warned = useRef(false);

  useEffect(() => {
    if (!deadline) return;
    warned.current = false;

    const playBeep = () => {
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 800;
        gain.gain.value = 0.3;
        osc.start();
        osc.stop(ctx.currentTime + 0.2);
      } catch (_) {}
    };

    const tick = () => {
      const remaining = getTimeLeft(deadline);
      setTimeLeft(remaining);

      // Warn at 5 minutes
      if (!warned.current && remaining.total > 0 && remaining.total <= 5 * 60 * 1000) {
        warned.current = true;
        playBeep();
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('⏰ 5 minutes left!', { body: 'Breakfast order deadline approaching.' });
        }
      }

      if (remaining.total <= 0 && onExpired) {
        onExpired();
      }
    };

    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [deadline, onExpired]);

  if (!deadline) return null;

  const { total, minutes, seconds } = timeLeft;
  const isUrgent = total > 0 && total <= 5 * 60 * 1000; // last 5 minutes

  if (total <= 0) {
    return (
      <span style={{ color: 'var(--danger)', fontWeight: 700, fontSize: '1.1rem' }}>
        ⏰ Expired
      </span>
    );
  }

  return (
    <span style={{
      fontWeight: 700,
      fontSize: '1.1rem',
      fontVariantNumeric: 'tabular-nums',
      color: isUrgent ? 'var(--danger)' : 'var(--warning, #f59e0b)',
      animation: isUrgent ? 'pulse 1s ease-in-out infinite' : 'none',
    }}>
      ⏱ {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
    </span>
  );
}

function getTimeLeft(deadline) {
  const total = Math.max(0, new Date(deadline).getTime() - Date.now());
  const minutes = Math.floor(total / 60000);
  const seconds = Math.floor((total % 60000) / 1000);
  return { total, minutes, seconds };
}
