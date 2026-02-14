const API_URL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api';

export async function createSession({ hostName, hostPaymentInfo, deliveryFee, deadline, restaurantId }) {
  const res = await fetch(`${API_URL}/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hostName, hostPaymentInfo, deliveryFee, deadline: deadline || null, restaurantId: restaurantId || null })
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to create session');
  }
  return res.json();
}

export async function getSession(sessionId) {
  const res = await fetch(`${API_URL}/sessions/${sessionId}`);
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Session not found');
  }
  return res.json();
}

export async function submitOrder(sessionId, { participantName, items }) {
  const res = await fetch(`${API_URL}/sessions/${sessionId}/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ participantName, items })
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to submit order');
  }
  return res.json();
}

export async function updatePayment(sessionId, participantName, paymentSent) {
  const res = await fetch(`${API_URL}/sessions/${sessionId}/orders/${encodeURIComponent(participantName)}/payment`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ paymentSent })
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to update payment');
  }
  return res.json();
}

export async function closeSession(sessionId) {
  const res = await fetch(`${API_URL}/sessions/${sessionId}`, { method: 'DELETE' });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to close session');
  }
  return res.json();
}

// ============ Host Management API ============

export async function updateDeliveryFee(sessionId, deliveryFee) {
  const res = await fetch(`${API_URL}/sessions/${sessionId}/delivery-fee`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deliveryFee })
  });
  if (!res.ok) { const err = await res.json(); throw new Error(err.error); }
  return res.json();
}

export async function deleteParticipantOrder(sessionId, participantName) {
  const res = await fetch(`${API_URL}/sessions/${sessionId}/orders/${encodeURIComponent(participantName)}`, {
    method: 'DELETE'
  });
  if (!res.ok) { const err = await res.json(); throw new Error(err.error); }
  return res.json();
}

export async function editParticipantOrder(sessionId, participantName, items) {
  const res = await fetch(`${API_URL}/sessions/${sessionId}/orders/${encodeURIComponent(participantName)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items })
  });
  if (!res.ok) { const err = await res.json(); throw new Error(err.error); }
  return res.json();
}

// ============ Restaurant API ============

export async function listRestaurants() {
  const res = await fetch(`${API_URL}/restaurants`);
  return res.json();
}

export async function getRestaurant(id) {
  const res = await fetch(`${API_URL}/restaurants/${id}`);
  if (!res.ok) throw new Error('Restaurant not found');
  return res.json();
}

export async function listAdminRestaurants() {
  const res = await fetch(`${API_URL}/admin/restaurants`);
  return res.json();
}

export async function createRestaurant(data) {
  const res = await fetch(`${API_URL}/admin/restaurants`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) { const err = await res.json(); throw new Error(err.error); }
  return res.json();
}

export async function updateRestaurant(id, data) {
  const res = await fetch(`${API_URL}/admin/restaurants/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) { const err = await res.json(); throw new Error(err.error); }
  return res.json();
}

export async function deleteRestaurant(id) {
  const res = await fetch(`${API_URL}/admin/restaurants/${id}`, { method: 'DELETE' });
  if (!res.ok) { const err = await res.json(); throw new Error(err.error); }
  return res.json();
}

export async function uploadMenuImage(restaurantId, file) {
  const formData = new FormData();
  formData.append('menuImage', file);
  const res = await fetch(`${API_URL}/admin/restaurants/${restaurantId}/menu-image`, {
    method: 'POST',
    body: formData
  });
  if (!res.ok) { const err = await res.json(); throw new Error(err.error); }
  return res.json();
}

export async function extractMenu(restaurantId, imageFilename) {
  const res = await fetch(`${API_URL}/admin/restaurants/${restaurantId}/extract-menu`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageFilename })
  });
  if (!res.ok) { const err = await res.json(); throw new Error(err.error); }
  return res.json();
}

export async function extractMenuFromUrls(restaurantId, photoUrls) {
  const res = await fetch(`${API_URL}/admin/restaurants/${restaurantId}/extract-menu-from-urls`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ photoUrls })
  });
  if (!res.ok) { const err = await res.json(); throw new Error(err.error); }
  return res.json();
}

export async function saveMenuItems(restaurantId, items) {
  const res = await fetch(`${API_URL}/admin/restaurants/${restaurantId}/menu-items`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items })
  });
  if (!res.ok) { const err = await res.json(); throw new Error(err.error); }
  return res.json();
}

export async function deleteMenuImage(restaurantId, filename) {
  const res = await fetch(`${API_URL}/admin/restaurants/${restaurantId}/menu-image/${filename}`, { method: 'DELETE' });
  if (!res.ok) { const err = await res.json(); throw new Error(err.error); }
  return res.json();
}
