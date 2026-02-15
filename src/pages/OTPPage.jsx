import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function OTPPage() {
  const { pendingOTPEmail, verifyOTP, resendOTP, cancelOTP } = useAuth();
  const navigate = useNavigate();
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const inputRefs = useRef([]);

  // Redirect if no pending OTP
  useEffect(() => {
    if (!pendingOTPEmail) {
      navigate('/login', { replace: true });
    }
  }, [pendingOTPEmail, navigate]);

  // Cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  // Focus first input on mount
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const handleChange = (index, value) => {
    // Only allow digits
    const digit = value.replace(/\D/g, '').slice(-1);
    const newDigits = [...digits];
    newDigits[index] = digit;
    setDigits(newDigits);
    setError('');

    // Auto-advance
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all filled
    if (digit && index === 5) {
      const code = newDigits.join('');
      if (code.length === 6) {
        handleVerify(code);
      }
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    const newDigits = [...digits];
    for (let i = 0; i < 6; i++) {
      newDigits[i] = pasted[i] || '';
    }
    setDigits(newDigits);
    if (pasted.length === 6) {
      handleVerify(pasted);
    } else {
      inputRefs.current[pasted.length]?.focus();
    }
  };

  const handleVerify = async (code) => {
    if (!code || code.length !== 6) {
      setError('Please enter the 6-digit code');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await verifyOTP(pendingOTPEmail, code);
      navigate('/');
    } catch (err) {
      setError(err.message);
      setDigits(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    try {
      await resendOTP(pendingOTPEmail);
      setResendCooldown(60);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  };

  const handleBack = () => {
    cancelOTP();
    navigate('/login');
  };

  if (!pendingOTPEmail) return null;

  return (
    <div className="container">
      <div className="card-glass" style={{ maxWidth: 420, margin: '60px auto', textAlign: 'center' }}>
        <h1 style={{ marginBottom: 8 }}>
          📧 <span className="gradient-text">Verify Email</span>
        </h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: 8 }}>
          We sent a 6-digit code to
        </p>
        <p style={{ color: 'var(--primary)', fontWeight: 600, marginBottom: 28 }}>
          {pendingOTPEmail}
        </p>

        {error && (
          <div style={{
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.25)',
            borderRadius: 10,
            padding: '10px 14px',
            marginBottom: 16,
            color: '#ef4444',
            fontSize: '0.9rem'
          }}>
            {error}
          </div>
        )}

        {/* OTP Input */}
        <div style={{
          display: 'flex',
          gap: 8,
          justifyContent: 'center',
          marginBottom: 28,
        }}>
          {digits.map((digit, i) => (
            <input
              key={i}
              ref={el => inputRefs.current[i] = el}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={e => handleChange(i, e.target.value)}
              onKeyDown={e => handleKeyDown(i, e)}
              onPaste={i === 0 ? handlePaste : undefined}
              disabled={loading}
              style={{
                width: 48,
                height: 56,
                textAlign: 'center',
                fontSize: '1.5rem',
                fontWeight: 700,
                borderRadius: 12,
                border: '2px solid var(--border)',
                background: 'rgba(255,255,255,0.03)',
                color: 'var(--text)',
                outline: 'none',
                transition: 'border-color 0.2s',
                caretColor: 'var(--primary)',
              }}
              onFocus={e => e.target.style.borderColor = 'var(--primary)'}
              onBlur={e => e.target.style.borderColor = 'var(--border)'}
            />
          ))}
        </div>

        <button
          className="btn btn-primary btn-block"
          onClick={() => handleVerify(digits.join(''))}
          disabled={loading || digits.join('').length !== 6}
        >
          {loading ? '⏳ Verifying...' : '✅ Verify Code'}
        </button>

        <div style={{ marginTop: 20 }}>
          <button
            onClick={handleResend}
            disabled={resendCooldown > 0}
            style={{
              background: 'none',
              border: 'none',
              color: resendCooldown > 0 ? 'var(--text-muted)' : 'var(--primary)',
              cursor: resendCooldown > 0 ? 'default' : 'pointer',
              fontSize: '0.9rem',
              padding: 0,
            }}
          >
            {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : '📩 Resend Code'}
          </button>
        </div>

        <button
          onClick={handleBack}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            fontSize: '0.85rem',
            marginTop: 16,
            padding: 0,
          }}
        >
          ← Back to Login
        </button>
      </div>
    </div>
  );
}
