import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AuthContext = createContext(null);

const API_URL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accessToken, setAccessToken] = useState(() => localStorage.getItem('accessToken'));
  const [refreshToken, setRefreshToken] = useState(() => localStorage.getItem('refreshToken'));

  // OTP state
  const [pendingOTPEmail, setPendingOTPEmail] = useState(null);

  // Persist tokens
  useEffect(() => {
    if (accessToken) localStorage.setItem('accessToken', accessToken);
    else localStorage.removeItem('accessToken');
  }, [accessToken]);

  useEffect(() => {
    if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
    else localStorage.removeItem('refreshToken');
  }, [refreshToken]);

  // Refresh access token
  const refresh = useCallback(async () => {
    const rt = refreshToken || localStorage.getItem('refreshToken');
    if (!rt) return null;

    try {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: rt }),
      });
      if (!res.ok) {
        setUser(null);
        setAccessToken(null);
        setRefreshToken(null);
        return null;
      }
      const data = await res.json();
      setAccessToken(data.accessToken);
      setUser(data.user);
      return data.accessToken;
    } catch {
      return null;
    }
  }, [refreshToken]);

  // Fetch with auto-refresh
  const authFetch = useCallback(async (url, options = {}) => {
    let token = accessToken || localStorage.getItem('accessToken');

    const doFetch = (t) =>
      fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          ...(t ? { Authorization: `Bearer ${t}` } : {}),
        },
      });

    let res = await doFetch(token);

    if (res.status === 401) {
      const body = await res.json().catch(() => ({}));
      if (body.code === 'TOKEN_EXPIRED') {
        const newToken = await refresh();
        if (newToken) {
          res = await doFetch(newToken);
        }
      }
    }

    return res;
  }, [accessToken, refresh]);

  // Initialize
  useEffect(() => {
    const init = async () => {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(`${API_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const userData = await res.json();
          setUser(userData);
        } else {
          await refresh();
        }
      } catch {
        // offline
      }
      setLoading(false);
    };
    init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Signup
  const signup = async (name, email, password, paymentInfo) => {
    const res = await fetch(`${API_URL}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, paymentInfo }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Signup failed');

    if (data.requiresOTP) {
      setPendingOTPEmail(data.email);
      return { requiresOTP: true, email: data.email };
    }

    // Direct token response (OTP disabled)
    setUser(data.user);
    setAccessToken(data.accessToken);
    setRefreshToken(data.refreshToken);
    return data;
  };

  // Login
  const login = async (email, password) => {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');

    if (data.requiresOTP) {
      setPendingOTPEmail(data.email);
      return { requiresOTP: true, email: data.email };
    }

    // Direct token response (OTP disabled)
    setUser(data.user);
    setAccessToken(data.accessToken);
    setRefreshToken(data.refreshToken);
    return data;
  };

  // Verify OTP (Step 2 → get tokens)
  const verifyOTP = async (email, otp) => {
    const res = await fetch(`${API_URL}/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, otp }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Verification failed');

    setUser(data.user);
    setAccessToken(data.accessToken);
    setRefreshToken(data.refreshToken);
    setPendingOTPEmail(null);
    return data.user;
  };

  // Resend OTP
  const resendOTP = async (email) => {
    const res = await fetch(`${API_URL}/auth/resend-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to resend');
    return data;
  };

  // Clear OTP state
  const cancelOTP = () => {
    setPendingOTPEmail(null);
  };

  // Logout
  const logout = async () => {
    try {
      const token = accessToken || localStorage.getItem('accessToken');
      const rt = refreshToken || localStorage.getItem('refreshToken');
      if (token) {
        await fetch(`${API_URL}/auth/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ refreshToken: rt }),
        });
      }
    } catch { /* best effort */ }

    setUser(null);
    setAccessToken(null);
    setRefreshToken(null);
  };

  const value = {
    user,
    loading,
    login,
    signup,
    logout,
    verifyOTP,
    resendOTP,
    cancelOTP,
    pendingOTPEmail,
    authFetch,
    accessToken,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
