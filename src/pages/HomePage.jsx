import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createSession, listRestaurants, getActiveFeed } from '../api';
import { useAuth } from '../contexts/AuthContext';
import LoadingOverlay from '../components/LoadingOverlay';
import { useToast } from '../components/Toast';

export default function HomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const [showForm, setShowForm] = useState(false);
  const [showCreated, setShowCreated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sessionUrl, setSessionUrl] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [copied, setCopied] = useState(false);
  const [restaurants, setRestaurants] = useState([]);
  const [activeSessions, setActiveSessions] = useState([]);

  const [form, setForm] = useState({
    hostPaymentInfo: '',
    deliveryFee: '',
    deadlineMinutes: '',
    restaurantId: ''
  });

  // Pre-fill payment info from user profile
  useEffect(() => {
    if (user?.paymentInfo) {
      setForm(prev => ({ ...prev, hostPaymentInfo: prev.hostPaymentInfo || user.paymentInfo }));
    }
  }, [user]);

  useEffect(() => {
    listRestaurants().then(setRestaurants).catch(() => {});
    getActiveFeed().then(setActiveSessions).catch(() => {});
  }, []);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.hostPaymentInfo || !form.deliveryFee) {
      toast.warning('Please fill all required fields');
      return;
    }

    setLoading(true);
    try {
      const data = await createSession({
        hostPaymentInfo: form.hostPaymentInfo,
        deliveryFee: form.deliveryFee,
        deadlineMinutes: form.deadlineMinutes ? parseInt(form.deadlineMinutes) : null,
        restaurantId: form.restaurantId || null
      });
      setSessionId(data.sessionId);
      const fullUrl = `${window.location.origin}/join/${data.sessionId}`;
      setSessionUrl(fullUrl);
      setShowForm(false);
      setShowCreated(true);
    } catch (err) {
      toast.error('Error creating session: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const copyUrl = () => {
    navigator.clipboard.writeText(sessionUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareWhatsApp = () => {
    const text = encodeURIComponent(`🍳 Join our breakfast order! ${sessionUrl}`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  if (loading) return <LoadingOverlay message="Creating session..." />;

  return (
    <div className="container">
      {/* Landing */}
      {!showForm && !showCreated && (
        <div className="card-glass" style={{ textAlign: 'center' }}>
          <h1>
            🍳 <span className="gradient-text">Breakfast Ordering</span>
          </h1>
          <p style={{ color: 'var(--text-muted)', marginTop: 12, fontSize: '1.1rem' }}>
            Simplify group breakfast orders with automatic cost splitting
          </p>

          <div className="features-grid">
            <div className="card feature-card">
              <span className="feature-icon">🔗</span>
              <h3>Share Link</h3>
              <p>Create session & share with team</p>
            </div>
            <div className="card feature-card">
              <span className="feature-icon">💰</span>
              <h3>Auto Calculate</h3>
              <p>Costs split automatically</p>
            </div>
            <div className="card feature-card">
              <span className="feature-icon">💳</span>
              <h3>Easy Payment</h3>
              <p>InstaPay info displayed</p>
            </div>
          </div>

          <button className="btn btn-primary btn-block" onClick={() => setShowForm(true)}>
            Create Order Session
          </button>

          <button
            className="btn btn-secondary btn-block"
            onClick={() => navigate('/admin')}
            style={{ marginTop: 10, opacity: 0.7 }}
          >
            ⚙️ Admin Panel
          </button>

          <button
            className="btn btn-secondary btn-block"
            onClick={() => navigate('/history')}
            style={{ marginTop: 6, opacity: 0.7 }}
          >
            📜 Order History
          </button>

          {/* Active Sessions Feed */}
          {activeSessions.length > 0 && (
            <div style={{ marginTop: 24, textAlign: 'left' }}>
              <h3 style={{ marginBottom: 12, color: 'var(--text)', fontSize: '1rem' }}>📡 Active Sessions</h3>
              {activeSessions.map(s => (
                <div
                  key={s.sessionId}
                  className="card"
                  style={{
                    padding: '14px 18px',
                    marginBottom: 8,
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    transition: 'border-color 0.2s',
                  }}
                  onClick={() => navigate(s.isHost ? `/host/${s.sessionId}` : `/join/${s.sessionId}`)}
                >
                  <div>
                    <span style={{ fontWeight: 600 }}>{s.hostName}</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginLeft: 8 }}>
                      {s.isHost ? '(Host)' : ''}
                    </span>
                    <div style={{ color: 'var(--text-dim)', fontSize: '0.8rem', marginTop: 2 }}>
                      👥 {s.participantCount} participants
                    </div>
                  </div>
                  <span style={{ color: 'var(--primary-light)', fontSize: '0.85rem', fontWeight: 500 }}>→</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create Form */}
      {showForm && (
        <div className="card-glass">
          <h2 style={{ marginBottom: 24 }}>Create Order Session</h2>
          <form onSubmit={handleSubmit}>
            <div style={{
              background: 'rgba(99,102,241,0.08)',
              border: '1px solid rgba(99,102,241,0.2)',
              borderRadius: 10,
              padding: '10px 14px',
              marginBottom: 16,
              fontSize: '0.9rem',
              color: 'var(--text)',
            }}>
              👤 Hosting as <strong>{user?.name}</strong>
            </div>
            <div className="form-group">
              <label htmlFor="hostPaymentInfo">Payment Info (InstaPay / Phone)</label>
              <input
                id="hostPaymentInfo"
                name="hostPaymentInfo"
                className="form-input"
                placeholder="01XXXXXXXXX"
                value={form.hostPaymentInfo}
                onChange={handleChange}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="deliveryFee">Delivery Fee (EGP)</label>
              <input
                id="deliveryFee"
                name="deliveryFee"
                type="number"
                className="form-input"
                placeholder="30"
                min="0"
                step="0.01"
                value={form.deliveryFee}
                onChange={handleChange}
                required
              />
            </div>

            {/* Restaurant Selector */}
            {restaurants.length > 0 && (
              <div className="form-group">
                <label htmlFor="restaurantId">Restaurant (optional)</label>
                <select
                  id="restaurantId"
                  name="restaurantId"
                  className="form-input"
                  value={form.restaurantId}
                  onChange={handleChange}
                >
                  <option value="">— No restaurant (manual items) —</option>
                  {restaurants.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.menuItemCount} items)
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="form-group">
              <label htmlFor="deadlineMinutes">Order Deadline — minutes (optional)</label>
              <input
                id="deadlineMinutes"
                name="deadlineMinutes"
                type="number"
                className="form-input"
                placeholder="e.g. 30"
                min="1"
                value={form.deadlineMinutes}
                onChange={handleChange}
              />
              {form.deadlineMinutes && (
                <small style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  Orders will close in {form.deadlineMinutes} minute{form.deadlineMinutes !== '1' ? 's' : ''}
                </small>
              )}
            </div>
            <div className="btn-group">
              <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                Create Session
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Session Created */}
      {showCreated && (
        <div className="card-glass">
          <h2 style={{ color: 'var(--success)', marginBottom: 16 }}>✅ Session Created!</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: 8 }}>Share this link with your team:</p>
          <div className="session-url-box">{sessionUrl}</div>
          <div className="btn-group" style={{ marginTop: 16 }}>
            <button className="btn btn-secondary" onClick={copyUrl}>
              {copied ? '✓ Copied!' : '📋 Copy Link'}
            </button>
            <button className="btn btn-whatsapp" onClick={shareWhatsApp}>
              💬 Share WhatsApp
            </button>
            <button className="btn btn-primary" onClick={() => navigate(`/host/${sessionId}`)}>
              View Dashboard →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
