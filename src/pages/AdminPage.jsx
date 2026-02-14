import React, { useState, useEffect, useCallback } from 'react';
import {
  listAdminRestaurants, createRestaurant, updateRestaurant, deleteRestaurant,
  uploadMenuImage, extractMenu, extractMenuFromUrls, saveMenuItems, deleteMenuImage
} from '../api';
import LoadingOverlay from '../components/LoadingOverlay';
import GoogleMapPicker from '../components/GoogleMapPicker';

export default function AdminPage() {
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [view, setView] = useState('list'); // list | form | menu

  // Form state
  const [form, setForm] = useState({ name: '', address: '', googleMapsUrl: '', phone: '' });

  // Menu state
  const [menuItems, setMenuItems] = useState([]);
  const [extracting, setExtracting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pendingPhotoUrls, setPendingPhotoUrls] = useState([]);
  const [autoExtractMsg, setAutoExtractMsg] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await listAdminRestaurants();
      setRestaurants(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const selected = restaurants.find(r => r.id === selectedId);

  // ============ Restaurant CRUD ============

  const handleCreateRestaurant = async () => {
    if (!form.name.trim()) return alert('Name is required');
    try {
      const restaurant = await createRestaurant(form);
      setRestaurants(prev => [...prev, restaurant]);
      setForm({ name: '', address: '', googleMapsUrl: '', phone: '' });
      setSelectedId(restaurant.id);
      setMenuItems(restaurant.menuItems || []);
      setView('menu');

      // Auto-extract menu from Google Maps photos if available
      if (pendingPhotoUrls.length > 0) {
        setAutoExtractMsg('🔍 Scanning Google Maps photos for menu...');
        setExtracting(true);
        try {
          const result = await extractMenuFromUrls(restaurant.id, pendingPhotoUrls);
          if (result.items && result.items.length > 0) {
            setMenuItems(result.items);
            if (result.source === 'menu') {
              setAutoExtractMsg(`✅ Found ${result.items.length} menu items from Google Maps photos!`);
            } else if (result.source === 'photos') {
              setAutoExtractMsg(`📸 Identified ${result.items.length} dishes from photos (no prices found — add manually)`);
            } else {
              setAutoExtractMsg(`✅ Extracted ${result.items.length} items`);
            }
          } else {
            setAutoExtractMsg('📷 No menu found in Google Maps photos. Upload a menu image or add items manually.');
          }
        } catch (err) {
          console.error('Auto extract error:', err);
          setAutoExtractMsg('⚠️ Could not extract menu from photos. Upload a menu image or add items manually.');
        } finally {
          setExtracting(false);
          setPendingPhotoUrls([]);
        }
      }
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const handleUpdateRestaurant = async () => {
    if (!form.name.trim()) return alert('Name is required');
    try {
      const updated = await updateRestaurant(selectedId, form);
      setRestaurants(prev => prev.map(r => r.id === selectedId ? updated : r));
      setView('menu');
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const handleDeleteRestaurant = async (id) => {
    if (!window.confirm('Delete this restaurant and all its data?')) return;
    try {
      await deleteRestaurant(id);
      setRestaurants(prev => prev.filter(r => r.id !== id));
      if (selectedId === id) {
        setSelectedId(null);
        setView('list');
      }
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const openEdit = (restaurant) => {
    setSelectedId(restaurant.id);
    setForm({ name: restaurant.name, address: restaurant.address, googleMapsUrl: restaurant.googleMapsUrl || '', phone: restaurant.phone || '' });
    setView('form');
  };

  const openMenu = (restaurant) => {
    setSelectedId(restaurant.id);
    setMenuItems(restaurant.menuItems || []);
    setView('menu');
  };

  const openNew = () => {
    setSelectedId(null);
    setForm({ name: '', address: '', googleMapsUrl: '', phone: '' });
    setView('form');
  };

  // ============ Menu Image & Extraction ============

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const result = await uploadMenuImage(selectedId, file);
      setRestaurants(prev => prev.map(r => r.id === selectedId ? result.restaurant : r));
    } catch (err) {
      alert('Upload error: ' + err.message);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleExtract = async (filename) => {
    setExtracting(true);
    try {
      const result = await extractMenu(selectedId, filename);
      // Merge extracted items with existing
      setMenuItems(prev => [...prev, ...result.items]);
      alert(`✅ Extracted ${result.items.length} items!`);
    } catch (err) {
      alert('Extraction error: ' + err.message);
    } finally {
      setExtracting(false);
    }
  };

  const handleDeleteImage = async (filename) => {
    try {
      await deleteMenuImage(selectedId, filename);
      setRestaurants(prev => prev.map(r => {
        if (r.id !== selectedId) return r;
        return { ...r, menuImages: r.menuImages.filter(f => f !== filename) };
      }));
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  // ============ Menu Item Editor ============

  const updateMenuItem = (index, field, value) => {
    const updated = [...menuItems];
    updated[index] = { ...updated[index], [field]: value };
    setMenuItems(updated);
  };

  const updateVariant = (itemIndex, variantIndex, field, value) => {
    const updated = [...menuItems];
    const variants = [...updated[itemIndex].variants];
    variants[variantIndex] = { ...variants[variantIndex], [field]: value };
    updated[itemIndex] = { ...updated[itemIndex], variants };
    setMenuItems(updated);
  };

  const addVariant = (itemIndex) => {
    const updated = [...menuItems];
    updated[itemIndex] = { ...updated[itemIndex], variants: [...updated[itemIndex].variants, { label: '', price: '' }] };
    setMenuItems(updated);
  };

  const removeVariant = (itemIndex, variantIndex) => {
    const updated = [...menuItems];
    updated[itemIndex] = { ...updated[itemIndex], variants: updated[itemIndex].variants.filter((_, i) => i !== variantIndex) };
    setMenuItems(updated);
  };

  const addMenuItem = () => {
    setMenuItems(prev => [...prev, { id: Date.now().toString(), name: '', category: '', variants: [{ label: 'default', price: '' }] }]);
  };

  const removeMenuItem = (index) => {
    setMenuItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleSaveMenu = async () => {
    try {
      const result = await saveMenuItems(selectedId, menuItems);
      setRestaurants(prev => prev.map(r => r.id === selectedId ? result : r));
      alert('✅ Menu saved!');
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  // ============ Categories ============
  const categories = [...new Set(menuItems.map(i => i.category).filter(Boolean))];

  if (loading) return <LoadingOverlay message="Loading..." />;

  // ============ Render ============
  return (
    <div className="container">
      <h1 style={{ marginBottom: 24 }}>⚙️ <span className="gradient-text">Admin Panel</span></h1>

      {/* List View */}
      {view === 'list' && (
        <>
          <button className="btn btn-primary" onClick={openNew} style={{ marginBottom: 24 }}>
            + Add Restaurant
          </button>

          {restaurants.length === 0 ? (
            <div className="empty-state">
              <span className="icon">🍽️</span>
              <p>No restaurants yet. Add one to get started!</p>
            </div>
          ) : (
            restaurants.map(r => (
              <div key={r.id} className="order-card" style={{ marginBottom: 16 }}>
                <div className="order-header">
                  <div>
                    <h3>{r.name}</h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: 4 }}>
                      {r.address || 'No address'} · {r.menuItems?.length || 0} menu items
                    </p>
                  </div>
                  <div className="btn-group">
                    <button className="btn btn-secondary" onClick={() => openMenu(r)} style={{ padding: '8px 14px', fontSize: '0.85rem' }}>
                      📋 Menu
                    </button>
                    <button className="btn btn-secondary" onClick={() => openEdit(r)} style={{ padding: '8px 14px', fontSize: '0.85rem' }}>
                      ✏️ Edit
                    </button>
                    <button className="btn btn-danger" onClick={() => handleDeleteRestaurant(r.id)} style={{ padding: '8px 14px', fontSize: '0.85rem' }}>
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </>
      )}

      {/* Form View (Create/Edit) */}
      {view === 'form' && (
        <div className="card-glass">
          <h2 style={{ marginBottom: 20 }}>{selectedId ? '✏️ Edit Restaurant' : '➕ New Restaurant'}</h2>

          {/* Google Maps Place Picker */}
          <GoogleMapPicker
            onPlaceSelect={(place) => {
              setForm({
                name: place.name,
                address: place.address,
                googleMapsUrl: place.googleMapsUrl,
                phone: place.phone,
              });
              // Store photo URLs for auto-extraction after creation
              if (place.photoUrls && place.photoUrls.length > 0) {
                setPendingPhotoUrls(place.photoUrls);
              }
            }}
          />

          <div className="form-group">
            <label>Restaurant Name *</label>
            <input className="form-input" placeholder="e.g. McDonald's" value={form.name}
              onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))} />
          </div>
          <div className="form-group">
            <label>Address</label>
            <input className="form-input" placeholder="Street, City" value={form.address}
              onChange={e => setForm(prev => ({ ...prev, address: e.target.value }))} />
          </div>
          <div className="form-group">
            <label>Google Maps URL</label>
            <input className="form-input" placeholder="https://maps.google.com/..." value={form.googleMapsUrl}
              onChange={e => setForm(prev => ({ ...prev, googleMapsUrl: e.target.value }))} />
          </div>
          <div className="form-group">
            <label>Phone</label>
            <input className="form-input" placeholder="+20 ..." value={form.phone}
              onChange={e => setForm(prev => ({ ...prev, phone: e.target.value }))} />
          </div>

          <div className="btn-group">
            <button className="btn btn-primary" onClick={selectedId ? handleUpdateRestaurant : handleCreateRestaurant}>
              {selectedId ? 'Save Changes' : 'Create Restaurant'}
            </button>
            <button className="btn btn-secondary" onClick={() => setView(selectedId ? 'menu' : 'list')}>Cancel</button>
          </div>
        </div>
      )}

      {/* Menu View */}
      {view === 'menu' && selected && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <h2>{selected.name}</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{selected.address}</p>
            </div>
            <button className="btn btn-secondary" onClick={() => { setView('list'); setSelectedId(null); }}>← Back</button>
          </div>

          {/* Auto-extract status */}
          {autoExtractMsg && (
            <div style={{
              padding: '12px 16px',
              background: autoExtractMsg.startsWith('✅') ? 'rgba(34,197,94,0.1)' :
                          autoExtractMsg.startsWith('⚠') ? 'rgba(239,68,68,0.1)' :
                          'rgba(99,102,241,0.1)',
              border: `1px solid ${autoExtractMsg.startsWith('✅') ? 'rgba(34,197,94,0.25)' :
                                   autoExtractMsg.startsWith('⚠') ? 'rgba(239,68,68,0.25)' :
                                   'rgba(99,102,241,0.25)'}`,
              borderRadius: 10,
              marginBottom: 16,
              fontSize: '0.9rem',
              color: 'var(--text)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}>
              {extracting && <span className="spinner" style={{ width: 16, height: 16 }} />}
              {autoExtractMsg}
              <button onClick={() => setAutoExtractMsg('')} style={{
                marginLeft: 'auto', background: 'none', border: 'none',
                color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1rem'
              }}>×</button>
            </div>
          )}

          {/* Menu Images */}
          <div className="card" style={{ marginBottom: 20 }}>
            <h3 style={{ marginBottom: 12 }}>📸 Menu Images</h3>

            {(selected.menuImages || []).length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12, marginBottom: 16 }}>
                {selected.menuImages.map(img => (
                  <div key={img} style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
                    <img src={`/api/uploads/${img}`} alt="Menu" style={{ width: '100%', height: 120, objectFit: 'cover' }} />
                    <div style={{ padding: 8, display: 'flex', gap: 4 }}>
                      <button
                        className="btn btn-primary"
                        onClick={() => handleExtract(img)}
                        disabled={extracting}
                        style={{ flex: 1, padding: '6px 8px', fontSize: '0.75rem' }}
                      >
                        {extracting ? '⏳...' : '🤖 Extract'}
                      </button>
                      <button
                        className="btn btn-danger"
                        onClick={() => handleDeleteImage(img)}
                        style={{ padding: '6px 8px', fontSize: '0.75rem' }}
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <label className="btn btn-secondary btn-block" style={{ cursor: 'pointer' }}>
              {uploading ? '⏳ Uploading...' : '📤 Upload Menu Image'}
              <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} disabled={uploading} />
            </label>
          </div>

          {/* Menu Items Editor */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3>📋 Menu Items ({menuItems.length})</h3>
              <div className="btn-group">
                <button className="btn btn-secondary" onClick={addMenuItem} style={{ padding: '8px 14px', fontSize: '0.85rem' }}>+ Add Item</button>
                <button className="btn btn-success" onClick={handleSaveMenu} style={{ padding: '8px 14px', fontSize: '0.85rem' }}>💾 Save Menu</button>
              </div>
            </div>

            {/* Group by category */}
            {categories.length > 0 ? (
              categories.map(cat => (
                <div key={cat} style={{ marginBottom: 20 }}>
                  <h4 style={{ color: 'var(--accent)', marginBottom: 10, borderBottom: '1px solid var(--border)', paddingBottom: 6 }}>{cat}</h4>
                  {menuItems.map((item, idx) => item.category === cat && (
                    <MenuItemRow key={item.id || idx} item={item} index={idx}
                      onUpdate={updateMenuItem} onRemove={removeMenuItem}
                      onUpdateVariant={updateVariant} onAddVariant={addVariant} onRemoveVariant={removeVariant} />
                  ))}
                </div>
              ))
            ) : null}

            {/* Uncategorized items */}
            {menuItems.filter(i => !i.category || !categories.includes(i.category)).map((item, idx) => {
              const realIdx = menuItems.indexOf(item);
              return (
                <MenuItemRow key={item.id || realIdx} item={item} index={realIdx}
                  onUpdate={updateMenuItem} onRemove={removeMenuItem}
                  onUpdateVariant={updateVariant} onAddVariant={addVariant} onRemoveVariant={removeVariant} />
              );
            })}

            {menuItems.length === 0 && (
              <p style={{ color: 'var(--text-dim)', textAlign: 'center', padding: 24 }}>
                No menu items yet. Upload a menu image and extract, or add items manually.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ============ Menu Item Row Component ============
function MenuItemRow({ item, index, onUpdate, onRemove, onUpdateVariant, onAddVariant, onRemoveVariant }) {
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: 14, marginBottom: 10 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 40px', gap: 8, marginBottom: 8 }}>
        <input className="form-input" placeholder="Item name" value={item.name}
          onChange={e => onUpdate(index, 'name', e.target.value)} style={{ padding: '8px 12px', fontSize: '0.9rem' }} />
        <input className="form-input" placeholder="Category" value={item.category}
          onChange={e => onUpdate(index, 'category', e.target.value)} style={{ padding: '8px 12px', fontSize: '0.9rem' }} />
        <button className="item-remove-btn" onClick={() => onRemove(index)}>×</button>
      </div>

      {/* Variants */}
      <div style={{ paddingLeft: 12 }}>
        {item.variants.map((v, vi) => (
          <div key={vi} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 30px', gap: 6, marginBottom: 4 }}>
            <input className="form-input" placeholder={item.variants.length === 1 ? 'default' : 'Size (S/M/L)'}
              value={v.label === 'default' ? '' : v.label}
              onChange={e => onUpdateVariant(index, vi, 'label', e.target.value || 'default')}
              style={{ padding: '6px 10px', fontSize: '0.82rem' }} />
            <input className="form-input" type="number" placeholder="Price" value={v.price}
              onChange={e => onUpdateVariant(index, vi, 'price', e.target.value)}
              style={{ padding: '6px 10px', fontSize: '0.82rem' }} />
            <button onClick={() => onRemoveVariant(index, vi)}
              style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '0.9rem',
                visibility: item.variants.length <= 1 ? 'hidden' : 'visible' }}>×</button>
          </div>
        ))}
        <button onClick={() => onAddVariant(index)}
          style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '0.8rem', padding: '4px 0' }}>
          + Add size/variant
        </button>
      </div>
    </div>
  );
}
