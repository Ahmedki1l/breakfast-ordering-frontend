import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMyHistory } from '../api';
import { Skeleton } from '../components/Skeleton';

export default function HistoryPage() {
  const navigate = useNavigate();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMyHistory()
      .then(setHistory)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  return (
    <div className="container">
      <div className="card-glass">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h1>📜 <span className="gradient-text">Order History</span></h1>
          <button
            className="btn btn-secondary"
            onClick={() => navigate('/')}
            style={{ padding: '8px 16px', fontSize: '0.85rem' }}
          >
            ← Home
          </button>
        </div>

        {loading ? (
          <div>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ marginBottom: 12 }}>
                <Skeleton height={14} width="30%" style={{ marginBottom: 8 }} />
                <Skeleton height={60} />
              </div>
            ))}
          </div>
        ) : history.length === 0 ? (
          <div className="empty-state" style={{ padding: 40 }}>
            <span className="icon" style={{ fontSize: '2.5rem' }}>📭</span>
            <p style={{ color: 'var(--text-muted)', marginTop: 12 }}>No order history yet.</p>
          </div>
        ) : (
          <div>
            {history.map((entry, idx) => (
              <div
                key={idx}
                className="card"
                style={{
                  padding: '16px 20px',
                  marginBottom: 10,
                  cursor: 'pointer',
                  transition: 'border-color 0.2s',
                }}
                onClick={() => navigate(entry.isHost ? `/host/${entry.sessionId}` : `/join/${entry.sessionId}`)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div>
                    <span style={{ fontWeight: 600 }}>{entry.hostName}</span>
                    {entry.isHost && (
                      <span style={{
                        marginLeft: 8,
                        padding: '2px 8px',
                        background: 'rgba(99,102,241,0.15)',
                        color: 'var(--primary-light)',
                        borderRadius: 6,
                        fontSize: '0.72rem',
                        fontWeight: 600,
                      }}>Host</span>
                    )}
                  </div>
                  <span className={`payment-badge ${entry.status === 'closed' ? 'paid' : 'pending'}`} style={{ fontSize: '0.72rem' }}>
                    {entry.status === 'closed' ? 'Closed' : 'Active'}
                  </span>
                </div>

                <div style={{ color: 'var(--text-dim)', fontSize: '0.82rem', marginBottom: 6 }}>
                  📅 {formatDate(entry.createdAt)}
                </div>

                {entry.myItems.length > 0 && (
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    {entry.myItems.map((item, i) => (
                      <span key={i}>
                        {item.name} ×{item.quantity || 1}
                        {i < entry.myItems.length - 1 ? ', ' : ''}
                      </span>
                    ))}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                  <span style={{ fontWeight: 600, color: 'var(--primary-light)', fontSize: '0.9rem' }}>
                    {entry.myTotal.toFixed(2)} EGP
                  </span>
                  <span style={{
                    fontSize: '0.75rem',
                    padding: '2px 8px',
                    borderRadius: 6,
                    background: entry.paymentSent ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                    color: entry.paymentSent ? '#6ee7b7' : '#fcd34d',
                    fontWeight: 600,
                  }}>
                    {entry.paymentSent ? '✓ Paid' : 'Unpaid'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
