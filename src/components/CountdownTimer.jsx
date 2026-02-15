import React, { useState, useEffect } from 'react';

export default function CountdownTimer({ deadline, onExpired }) {
  const [timeLeft, setTimeLeft] = useState(getTimeLeft(deadline));

  useEffect(() => {
    if (!deadline) return;

    const tick = () => {
      const remaining = getTimeLeft(deadline);
      setTimeLeft(remaining);
      if (remaining.total <= 0 && onExpired) {
        onExpired();
      }
    };

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
