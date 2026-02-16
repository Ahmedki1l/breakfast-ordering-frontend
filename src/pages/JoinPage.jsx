import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { getSession, submitOrder, updatePayment } from '../api';
import { useSocket } from '../useSocket';
import { useAuth } from '../contexts/AuthContext';
import LoadingOverlay from '../components/LoadingOverlay';
import CountdownTimer from '../components/CountdownTimer';
import { useToast } from '../components/Toast';
import { SessionSkeleton } from '../components/Skeleton';

const emptyItem = () => ({ name: '', price: '', quantity: 1 });

export default function JoinPage() {
  const { sessionId } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [submitted, setSubmitted] = useState(false);

  const participantName = user?.name || '';
  const [items, setItems] = useState([emptyItem()]);
  const [participantCount, setParticipantCount] = useState(0);
  const [menuSearch, setMenuSearch] = useState('');
  const [lastOrder, setLastOrder] = useState(null);

  // Load last order from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('breakfast_last_order');
      if (saved) setLastOrder(JSON.parse(saved));
    } catch (_) {}
  }, []);

  const loadSession = useCallback(async () => {
    try {
      const data = await getSession(sessionId);
      setSession(data);
      setParticipantCount(data.orders?.length || 0);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  const handleUpdate = useCallback((data) => {
    if (data?.orders) {
      setParticipantCount(data.orders.length);
    }
  }, []);

  const handleClosed = useCallback(() => {
    toast.warning('Session has been closed by the host');
    setTimeout(() => { window.location.href = '/'; }, 1500);
  }, [toast]);

  useSocket(sessionId, { onUpdate: handleUpdate, onClosed: handleClosed });

  // Cost calculations
  const itemsTotal = items.reduce((sum, item) => {
    const price = parseFloat(item.price) || 0;
    const qty = parseInt(item.quantity) || 1;
    return sum + price * qty;
  }, 0);

  const deliveryFee = session?.deliveryFee || 0;
  const deliveryShare = participantCount > 0 ? deliveryFee / participantCount : deliveryFee;
  const grandTotal = itemsTotal + deliveryShare;

  // Deadline check (reactive via state)
  const [deadlinePassed, setDeadlinePassed] = useState(false);
  useEffect(() => {
    if (!session?.deadline) return;
    const check = () => setDeadlinePassed(new Date() > new Date(session.deadline));
    check();
    const interval = setInterval(check, 1000);
    return () => clearInterval(interval);
  }, [session?.deadline]);

  // Restaurant menu
  const restaurant = session?.restaurant;
  const menuItems = restaurant?.menuItems || [];

  // Group menu by category
  const menuByCategory = {};
  menuItems.forEach(item => {
    const cat = item.category || 'Other';
    if (!menuByCategory[cat]) menuByCategory[cat] = [];
    menuByCategory[cat].push(item);
  });

  // Filter menu items by search
  const filteredMenuByCategory = {};
  Object.entries(menuByCategory).forEach(([cat, catItems]) => {
    const filtered = menuSearch
      ? catItems.filter(i => i.name.toLowerCase().includes(menuSearch.toLowerCase()))
      : catItems;
    if (filtered.length > 0) filteredMenuByCategory[cat] = filtered;
  });

  // Add from menu
  const addFromMenu = (menuItem, variant) => {
    const price = variant.price;
    const label = variant.label === 'default' ? '' : ` (${variant.label})`;
    const name = `${menuItem.name}${label}`;

    // Check if already in items list
    const existingIdx = items.findIndex(i => i.name === name && parseFloat(i.price) === price);
    if (existingIdx >= 0) {
      const updated = [...items];
      updated[existingIdx] = { ...updated[existingIdx], quantity: (parseInt(updated[existingIdx].quantity) || 1) + 1 };
      setItems(updated);
    } else {
      // Replace empty first item or append
      if (items.length === 1 && !items[0].name && !items[0].price) {
        setItems([{ name, price: String(price), quantity: 1 }]);
      } else {
        setItems([...items, { name, price: String(price), quantity: 1 }]);
      }
    }
  };

  // Item management
  const updateItem = (index, field, value) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    setItems(updated);
  };

  const addItem = () => setItems([...items, emptyItem()]);

  const removeItem = (index) => {
    if (items.length <= 1) {
      setItems([emptyItem()]);
      return;
    }
    setItems(items.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {

    const validItems = items
      .filter(item => item.name.trim() && parseFloat(item.price) > 0)
      .map(item => ({
        name: item.name.trim(),
        price: parseFloat(item.price),
        quantity: parseInt(item.quantity) || 1
      }));

    if (validItems.length === 0) {
      toast.warning('Please add at least one item');
      return;
    }

    setSubmitting(true);
    try {
      await submitOrder(sessionId, { items: validItems });
      // Save to localStorage for 'same as last order'
      localStorage.setItem('breakfast_last_order', JSON.stringify(validItems));
      setSubmitted(true);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditOrder = () => {
    setSubmitted(false);
  };

  const handleMarkPaid = async () => {
    try {
      await updatePayment(sessionId, participantName, true);
      toast.success('Marked as paid! Thank you!');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const copyPaymentInfo = () => {
    navigator.clipboard.writeText(session.hostPaymentInfo);
    toast.success('Payment info copied!');
  };

  if (loading) return <SessionSkeleton />;
  if (submitting) return <LoadingOverlay message="Submitting order..." />;
  if (error) return (
    <div className="container">
      <div className="card-glass" style={{ textAlign: 'center' }}>
        <h2 style={{ color: 'var(--danger)' }}>Error</h2>
        <p style={{ color: 'var(--text-muted)', marginTop: 8 }}>{error}</p>
      </div>
    </div>
  );

  return (
    <div className="container">
      <div className="card-glass">
        <h1 style={{ marginBottom: 16 }}>🍳 <span className="gradient-text">Join Order</span></h1>

        {/* Session Info */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
          <div className="info-item" style={{ flex: 1, minWidth: 120 }}>
            <span className="label">Host</span>
            <span className="value">{session.hostName}</span>
          </div>
          <div className="info-item" style={{ flex: 1, minWidth: 120 }}>
            <span className="label">Delivery Fee</span>
            <span className="value">{session.deliveryFee} EGP</span>
          </div>
          {restaurant && (
            <div className="info-item" style={{ flex: 1, minWidth: 120 }}>
              <span className="label">Restaurant</span>
              <span className="value">{restaurant.name}</span>
            </div>
          )}
          {session.deadline && (
            <div className="info-item" style={{ flex: 1, minWidth: 120 }}>
              <span className="label">Time Left</span>
              <CountdownTimer
                deadline={session.deadline}
                onExpired={() => setDeadlinePassed(true)}
              />
            </div>
          )}
        </div>

        {/* Deadline expired */}
        {deadlinePassed && (
          <div className="deadline-expired">
            <h2>⏰ Time's Up!</h2>
            <p>The ordering window has closed</p>
          </div>
        )}

        {/* Closed */}
        {session.status === 'closed' && (
          <div className="deadline-expired">
            <h2>🔒 Session Closed</h2>
            <p>This session has been closed by the host.</p>
          </div>
        )}

        {/* Order Form */}
        {!submitted && !deadlinePassed && session.status === 'active' && (
          <>
            <div style={{
              background: 'rgba(99,102,241,0.08)',
              border: '1px solid rgba(99,102,241,0.2)',
              borderRadius: 10,
              padding: '10px 14px',
              marginBottom: 16,
              fontSize: '0.9rem',
              color: 'var(--text)',
            }}>
              👤 Ordering as <strong>{participantName}</strong>
            </div>

            {/* Same as last order button */}
            {lastOrder && lastOrder.length > 0 && items.length === 1 && !items[0].name && (
              <button
                className="btn btn-block"
                onClick={() => {
                  setItems(lastOrder.map(i => ({ name: i.name, price: String(i.price), quantity: i.quantity || 1 })));
                  toast.success('Previous order loaded!');
                }}
                style={{
                  marginBottom: 16,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'stretch',
                  gap: 10,
                  padding: '14px 16px',
                  background: 'linear-gradient(135deg, rgba(99,102,241,0.10), rgba(6,182,212,0.06))',
                  border: '1px dashed rgba(99,102,241,0.35)',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  textAlign: 'start',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: '0.92rem' }}>
                  🔄 Same as last order
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {lastOrder.map((item, i) => (
                    <span key={i} style={{
                      padding: '3px 10px',
                      background: 'rgba(99,102,241,0.12)',
                      border: '1px solid rgba(99,102,241,0.2)',
                      borderRadius: 20,
                      fontSize: '0.78rem',
                      color: 'var(--text-dim)',
                      whiteSpace: 'nowrap',
                    }}>
                      {item.name} {item.quantity > 1 ? `×${item.quantity}` : ''}
                    </span>
                  ))}
                </div>
              </button>
            )}

            {/* Restaurant Menu Catalog */}
            {menuItems.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <h3 style={{ marginBottom: 12, color: 'var(--accent)' }}>📋 {restaurant.name} Menu</h3>
                <input
                  className="form-input"
                  placeholder="🔍 Search menu..."
                  value={menuSearch}
                  onChange={e => setMenuSearch(e.target.value)}
                  style={{ marginBottom: 12 }}
                />
                <div className="menu-catalog">
                  {Object.entries(filteredMenuByCategory).map(([category, catItems]) => (
                    <div key={category} style={{ marginBottom: 16 }}>
                      <h4 style={{ color: 'var(--primary-light)', fontSize: '0.9rem', marginBottom: 8, borderBottom: '1px solid var(--border)', paddingBottom: 4 }}>
                        {category}
                      </h4>
                      {catItems.map(menuItem => {
                        const isSingleVariant = menuItem.variants.length === 1;
                        return (
                          <div
                            key={menuItem.id}
                            className={`menu-item-card${isSingleVariant ? ' menu-item-card--single' : ''}`}
                            onClick={isSingleVariant ? () => addFromMenu(menuItem, menuItem.variants[0]) : undefined}
                            style={isSingleVariant ? { cursor: 'pointer' } : {}}
                          >
                            <span className="menu-item-name">{menuItem.name}</span>
                            {isSingleVariant ? (
                              <span className="variant-price" style={{ fontWeight: 600, color: 'var(--primary-light)' }}>
                                {menuItem.variants[0].price} EGP
                              </span>
                            ) : (
                              <div className="menu-item-variants">
                                {menuItem.variants.map((v, vi) => (
                                  <button
                                    key={vi}
                                    className="btn menu-variant-btn"
                                    onClick={() => addFromMenu(menuItem, v)}
                                  >
                                    {v.label !== 'default' && <span className="variant-label">{v.label}</span>}
                                    <span className="variant-price">{v.price} EGP</span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="form-group">
              <label>{menuItems.length > 0 ? 'Your Selected Items' : 'Your Items'}</label>
              <div className="items-list">
                {items.map((item, index) => (
                  <div key={index} className="item-row">
                    <input
                      className="form-input"
                      placeholder="Item name"
                      value={item.name}
                      onChange={(e) => updateItem(index, 'name', e.target.value)}
                    />
                    <input
                      className="form-input"
                      type="number"
                      placeholder="Price"
                      step="0.01"
                      value={item.price}
                      onChange={(e) => updateItem(index, 'price', e.target.value)}
                    />
                    <input
                      className="form-input"
                      type="number"
                      placeholder="Qty"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                    />
                    <button
                      className="item-remove-btn"
                      onClick={() => removeItem(index)}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <button className="btn btn-secondary btn-block" onClick={addItem}>
                + Add Custom Item
              </button>
            </div>

            {/* Cost Summary */}
            <div className="summary-card">
              <h3 style={{ marginBottom: 12 }}>Your Cost</h3>
              <div className="summary-row">
                <span>Items</span>
                <span className="amount">{itemsTotal.toFixed(2)} EGP</span>
              </div>
              <div className="summary-row">
                <span>Delivery Share</span>
                <span className="amount">{deliveryShare.toFixed(2)} EGP</span>
              </div>
              <div className="summary-row grand-total">
                <span>Total</span>
                <span className="amount">{grandTotal.toFixed(2)} EGP</span>
              </div>
            </div>

            <button className="btn btn-primary btn-block" onClick={handleSubmit}>
              Submit Order
            </button>
          </>
        )}

        {/* Order Submitted — Confirmation Receipt */}
        {submitted && (
          <>
            <div style={{
              textAlign: 'center',
              padding: '24px 0 16px',
              borderBottom: '1px dashed var(--border)',
              marginBottom: 20,
            }}>
              <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>✅</div>
              <h2 style={{ color: 'var(--success)', marginBottom: 4 }}>Order Confirmed!</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                {' · '}
                {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>

            <div className="summary-card">
              <h3 style={{ marginBottom: 12 }}>Your Order</h3>
              {items.filter(i => i.name).map((item, i) => (
                <div key={i} className="summary-row">
                  <span>{item.name} × {item.quantity || 1}</span>
                  <span className="amount">{((parseFloat(item.price) || 0) * (parseInt(item.quantity) || 1)).toFixed(2)} EGP</span>
                </div>
              ))}
              <div className="summary-row grand-total">
                <span>Amount to Pay</span>
                <span className="amount">{grandTotal.toFixed(2)} EGP</span>
              </div>
            </div>

            <div className="payment-info-box">
              <h3>💳 Send Payment To</h3>
              <div className="payment-number">{session.hostPaymentInfo}</div>
              <div className="btn-group" style={{ justifyContent: 'center' }}>
                <button className="btn btn-secondary" onClick={copyPaymentInfo}>
                  📋 Copy Number
                </button>
                <button className="btn btn-success" onClick={handleMarkPaid}>
                  ✓ Mark as Paid
                </button>
              </div>
            </div>

            {!deadlinePassed && session.status === 'active' && (
              <button
                className="btn btn-secondary btn-block"
                onClick={handleEditOrder}
                style={{ marginTop: 16 }}
              >
                ✏️ Edit My Order
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
