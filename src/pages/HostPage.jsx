import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { getSession, closeSession as apiCloseSession, submitOrder } from '../api';
import { useSocket } from '../useSocket';
import LoadingOverlay from '../components/LoadingOverlay';

export default function HostPage() {
  const { sessionId } = useParams();
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [showMyOrder, setShowMyOrder] = useState(false);
  const [myItems, setMyItems] = useState([{ name: '', price: '', quantity: 1 }]);
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [hostMenuSearch, setHostMenuSearch] = useState('');

  const loadSession = useCallback(async () => {
    try {
      const data = await getSession(sessionId);
      setSession(data);
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

  const handleUpdate = useCallback(() => {
    loadSession();
  }, [loadSession]);

  const handleClosed = useCallback(() => {
    alert('Session has been closed');
  }, []);

  useSocket(sessionId, { onUpdate: handleUpdate, onClosed: handleClosed });

  const shareUrl = `${window.location.origin}/join/${sessionId}`;

  const copyUrl = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const shareWhatsApp = () => {
    const text = encodeURIComponent(`🍳 Join our breakfast order! ${shareUrl}`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  // Build combined order (aggregate all items across participants)
  const buildCombinedOrder = () => {
    if (!session?.costs?.length) return [];
    const itemMap = new Map();
    session.costs.forEach(p => {
      p.items.forEach(item => {
        const key = `${item.name}__${item.price}`;
        if (itemMap.has(key)) {
          const existing = itemMap.get(key);
          existing.quantity += item.quantity;
          existing.orderedBy.push(p.name);
        } else {
          itemMap.set(key, {
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            orderedBy: [p.name]
          });
        }
      });
    });
    return Array.from(itemMap.values());
  };

  const combinedItems = buildCombinedOrder();

  const copyCombinedOrder = () => {
    if (!combinedItems.length) return;
    const text = combinedItems
      .map(item => `${item.name} × ${item.quantity}`)
      .join('\n');
    navigator.clipboard.writeText(text);
    alert('Combined order copied!');
  };

  const exportCSV = () => {
    if (!session?.costs?.length) {
      alert('No orders to export');
      return;
    }

    let csv = 'Name,Items,Items Total,Delivery Share,Total,Payment Status\n';
    session.costs.forEach(p => {
      const items = p.items.map(i => `${i.name} x${i.quantity} (${i.price})`).join('; ');
      csv += `"${p.name}","${items}",${p.itemsTotal},${p.deliveryShare},${p.total},${p.paymentSent ? 'Paid' : 'Pending'}\n`;
    });
    csv += `\nSummary\nTotal Food,${session.summary.totalFood}\nDelivery Fee,${session.summary.totalDelivery}\nGrand Total,${session.summary.grandTotal}\n`;
    csv += `\nCombined Order\nItem,Quantity,Unit Price\n`;
    combinedItems.forEach(item => {
      csv += `"${item.name}",${item.quantity},${item.price}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `breakfast-order-${sessionId}-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCloseSession = async () => {
    if (!window.confirm('Are you sure? No more orders can be added.')) return;
    try {
      await apiCloseSession(sessionId);
      alert('Session closed!');
      loadSession();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const updateMyItem = (index, field, value) => {
    const updated = [...myItems];
    updated[index] = { ...updated[index], [field]: value };
    setMyItems(updated);
  };

  const addMyItem = () => setMyItems([...myItems, { name: '', price: '', quantity: 1 }]);

  const removeMyItem = (index) => {
    if (myItems.length <= 1) return;
    setMyItems(myItems.filter((_, i) => i !== index));
  };

  const handleMyOrderSubmit = async () => {
    const validItems = myItems.map(item => ({
      name: item.name.trim(),
      price: parseFloat(item.price),
      quantity: parseInt(item.quantity) || 1
    }));
    const invalid = validItems.some(i => !i.name || !i.price || i.price <= 0);
    if (invalid) {
      alert('Please fill all item details with valid prices');
      return;
    }
    setSubmittingOrder(true);
    try {
      await submitOrder(sessionId, { participantName: session.hostName, items: validItems });
      setShowMyOrder(false);
      setMyItems([{ name: '', price: '', quantity: 1 }]);
      loadSession();
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setSubmittingOrder(false);
    }
  };

  if (loading) return <LoadingOverlay message="Loading dashboard..." />;
  if (error) return (
    <div className="container">
      <div className="card-glass" style={{ textAlign: 'center' }}>
        <h2 style={{ color: 'var(--danger)' }}>Error</h2>
        <p style={{ color: 'var(--text-muted)', marginTop: 8 }}>{error}</p>
      </div>
    </div>
  );

  const costs = session.costs || [];
  const summary = session.summary || {};

  return (
    <div className="container">
      <h1 style={{ marginBottom: 24 }}>🍳 <span className="gradient-text">Host Dashboard</span></h1>

      {/* Info Cards */}
      <div className="header-info">
        <div className="info-item">
          <span className="label">Session ID</span>
          <span className="value">{session.sessionId}</span>
        </div>
        <div className="info-item">
          <span className="label">Host</span>
          <span className="value">{session.hostName}</span>
        </div>
        <div className="info-item">
          <span className="label">Delivery Fee</span>
          <span className="value">{session.deliveryFee} EGP</span>
        </div>
        <div className="info-item">
          <span className="label">Participants</span>
          <span className="value">{costs.length}</span>
        </div>
        {session.deadline && (
          <div className="info-item">
            <span className="label">Deadline</span>
            <span className="value">{new Date(session.deadline).toLocaleString()}</span>
          </div>
        )}
      </div>

      {/* Share */}
      <div className="share-section">
        <h3>📤 Share this link with your team</h3>
        <div className="session-url-box">{shareUrl}</div>
        <div className="btn-group">
          <button className="btn btn-secondary" onClick={copyUrl}>
            {copiedUrl ? '✓ Copied!' : '📋 Copy Link'}
          </button>
          <button className="btn btn-whatsapp" onClick={shareWhatsApp}>
            💬 WhatsApp
          </button>
          <button className="btn btn-secondary" onClick={exportCSV}>
            📥 Export CSV
          </button>
          <button className="btn btn-danger" onClick={handleCloseSession}>
            Close Session
          </button>
        </div>
      </div>

      {/* Restaurant Info */}
      {session.restaurant && (
        <div style={{ marginBottom: 20 }}>
          <span className="restaurant-badge">
            🍽️ {session.restaurant.name}
            {session.restaurant.address && ` · ${session.restaurant.address}`}
          </span>
        </div>
      )}

      {/* Host's Own Order */}
      {(() => {
        const hostOrder = costs.find(c => c.name === session.hostName);
        const startEdit = () => {
          setMyItems(hostOrder.items.map(i => ({ name: i.name, price: String(i.price), quantity: i.quantity })));
          setShowMyOrder(true);
        };
        return (
          <div className="card" style={{ marginBottom: 28 }}>
            {!hostOrder && !showMyOrder && (
              <button className="btn btn-success btn-block" onClick={() => setShowMyOrder(true)}>
                🍽️ Add My Order
              </button>
            )}
            {hostOrder && !showMyOrder && (
              <button className="btn btn-secondary btn-block" onClick={startEdit}>
                ✏️ Edit My Order
              </button>
            )}
            {showMyOrder && (
            <>
              <h3 style={{ marginBottom: 16 }}>🍽️ Your Order ({session.hostName})</h3>

              {/* Host Menu Picker */}
              {session.restaurant?.menuItems?.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <input
                    className="form-input"
                    placeholder="🔍 Search menu..."
                    value={hostMenuSearch}
                    onChange={e => setHostMenuSearch(e.target.value)}
                    style={{ marginBottom: 10 }}
                  />
                  <div className="menu-catalog">
                    {(() => {
                      const menuByCategory = {};
                      session.restaurant.menuItems.forEach(item => {
                        const cat = item.category || 'Other';
                        if (!menuByCategory[cat]) menuByCategory[cat] = [];
                        menuByCategory[cat].push(item);
                      });
                      return Object.entries(menuByCategory).map(([category, catItems]) => {
                        const filtered = hostMenuSearch
                          ? catItems.filter(i => i.name.toLowerCase().includes(hostMenuSearch.toLowerCase()))
                          : catItems;
                        if (filtered.length === 0) return null;
                        return (
                          <div key={category} style={{ marginBottom: 12 }}>
                            <h4 style={{ color: 'var(--primary-light)', fontSize: '0.85rem', marginBottom: 6, borderBottom: '1px solid var(--border)', paddingBottom: 4 }}>
                              {category}
                            </h4>
                            {filtered.map(menuItem => (
                              <div key={menuItem.id} className="menu-item-card">
                                <span className="menu-item-name">{menuItem.name}</span>
                                <div className="menu-item-variants">
                                  {menuItem.variants.map((v, vi) => (
                                    <button
                                      key={vi}
                                      className="btn menu-variant-btn"
                                      onClick={() => {
                                        const label = v.label === 'default' ? '' : ` (${v.label})`;
                                        const name = `${menuItem.name}${label}`;
                                        const existingIdx = myItems.findIndex(i => i.name === name && parseFloat(i.price) === v.price);
                                        if (existingIdx >= 0) {
                                          const updated = [...myItems];
                                          updated[existingIdx] = { ...updated[existingIdx], quantity: (parseInt(updated[existingIdx].quantity) || 1) + 1 };
                                          setMyItems(updated);
                                        } else if (myItems.length === 1 && !myItems[0].name && !myItems[0].price) {
                                          setMyItems([{ name, price: String(v.price), quantity: 1 }]);
                                        } else {
                                          setMyItems([...myItems, { name, price: String(v.price), quantity: 1 }]);
                                        }
                                      }}
                                    >
                                      {v.label !== 'default' && <span className="variant-label">{v.label}</span>}
                                      <span className="variant-price">{v.price} EGP</span>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              )}
              <div className="items-list">
                {myItems.map((item, index) => (
                  <div key={index} className="item-row">
                    <input
                      className="form-input"
                      placeholder="Item name"
                      value={item.name}
                      onChange={(e) => updateMyItem(index, 'name', e.target.value)}
                    />
                    <input
                      className="form-input"
                      type="number"
                      placeholder="Price"
                      step="0.01"
                      value={item.price}
                      onChange={(e) => updateMyItem(index, 'price', e.target.value)}
                    />
                    <input
                      className="form-input"
                      type="number"
                      placeholder="Qty"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => updateMyItem(index, 'quantity', e.target.value)}
                    />
                    <button
                      className="item-remove-btn"
                      onClick={() => removeMyItem(index)}
                      style={myItems.length <= 1 ? { visibility: 'hidden' } : {}}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <div className="btn-group" style={{ marginTop: 12 }}>
                <button className="btn btn-secondary" onClick={addMyItem}>+ Add Item</button>
                <button className="btn btn-primary" onClick={handleMyOrderSubmit} disabled={submittingOrder}>
                  {submittingOrder ? 'Submitting...' : 'Submit My Order'}
                </button>
                <button className="btn btn-secondary" onClick={() => setShowMyOrder(false)}>Cancel</button>
              </div>
            </>
          )}
        </div>
        );
      })()}

      {/* Combined Order */}
      {combinedItems.length > 0 && (
        <div className="card" style={{ marginBottom: 28 }}>
          <div className="section-header" style={{ marginBottom: 14 }}>
            <h2>📦 Combined Order</h2>
            <button className="btn btn-secondary" onClick={copyCombinedOrder} style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
              📋 Copy
            </button>
          </div>
          <div className="order-items">
            {combinedItems.map((item, i) => (
              <div key={i} className="order-item-row">
                <span>
                  {item.name} × {item.quantity}
                  <span style={{ color: 'var(--text-dim)', fontSize: '0.8rem', marginLeft: 8 }}>
                    ({item.orderedBy.join(', ')})
                  </span>
                </span>
                <span>{(item.price * item.quantity).toFixed(2)} EGP</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="summary-card">
        <h2 style={{ marginBottom: 16 }}>💰 Total Summary</h2>
        <div className="summary-row">
          <span>Total Food</span>
          <span className="amount">{(summary.totalFood || 0).toFixed(2)} EGP</span>
        </div>
        <div className="summary-row">
          <span>Delivery Fee</span>
          <span className="amount">{(summary.totalDelivery || 0).toFixed(2)} EGP</span>
        </div>
        <div className="summary-row grand-total">
          <span>Grand Total</span>
          <span className="amount">{(summary.grandTotal || 0).toFixed(2)} EGP</span>
        </div>
      </div>

      {/* Individual Orders */}
      <div className="section-header">
        <h2>📋 Orders <span className="badge">{costs.length}</span></h2>
      </div>

      {costs.length === 0 ? (
        <div className="empty-state">
          <span className="icon">🍽️</span>
          <p>No orders yet. Share the link to start collecting!</p>
        </div>
      ) : (
        costs.map((participant, idx) => (
          <div key={idx} className="order-card">
            <div className="order-header">
              <h3>{participant.name}</h3>
              <span className={`payment-badge ${participant.paymentSent ? 'paid' : 'pending'}`}>
                {participant.paymentSent ? '✓ Paid' : 'Pending'}
              </span>
            </div>
            <div className="order-items">
              {participant.items.map((item, i) => (
                <div key={i} className="order-item-row">
                  <span>{item.name} × {item.quantity}</span>
                  <span>{(item.price * item.quantity).toFixed(2)} EGP</span>
                </div>
              ))}
            </div>
            <div className="order-total">
              <div className="breakdown">
                Items: {participant.itemsTotal.toFixed(2)} EGP<br />
                Delivery: {participant.deliveryShare.toFixed(2)} EGP
              </div>
              <span className="total-amount">{participant.total.toFixed(2)} EGP</span>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
