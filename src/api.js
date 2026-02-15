const API_URL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api';

function getAuthHeaders() {
  const token = localStorage.getItem('accessToken');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function authFetch(url, options = {}) {
  const headers = {
    ...options.headers,
    ...getAuthHeaders(),
  };

  let res = await fetch(url, { ...options, headers });

  // If token expired, try to refresh
  if (res.status === 401) {
    const body = await res.clone().json().catch(() => ({}));
    if (body.code === 'TOKEN_EXPIRED') {
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        const refreshRes = await fetch(`${API_URL}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
        if (refreshRes.ok) {
          const data = await refreshRes.json();
          localStorage.setItem('accessToken', data.accessToken);
          // Retry original request with new token
          headers.Authorization = `Bearer ${data.accessToken}`;
          res = await fetch(url, { ...options, headers });
        }
      }
    }
  }

  return res;
}

// ============ Session API ============

export async function createSession({ hostPaymentInfo, deliveryFee, deadlineMinutes, restaurantId }) {
  const res = await authFetch(`${API_URL}/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hostPaymentInfo, deliveryFee, deadlineMinutes: deadlineMinutes || null, restaurantId: restaurantId || null })
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

export async function submitOrder(sessionId, { items }) {
  const res = await authFetch(`${API_URL}/sessions/${sessionId}/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items })
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to submit order');
  }
  return res.json();
}

export async function updatePayment(sessionId, participantName, paymentSent) {
  const res = await authFetch(`${API_URL}/sessions/${sessionId}/orders/${encodeURIComponent(participantName)}/payment`, {
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
  const res = await authFetch(`${API_URL}/sessions/${sessionId}`, { method: 'DELETE' });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to close session');
  }
  return res.json();
}

// ============ Host Management API ============

export async function updateDeliveryFee(sessionId, deliveryFee) {
  const res = await authFetch(`${API_URL}/sessions/${sessionId}/delivery-fee`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deliveryFee })
  });
  if (!res.ok) { const err = await res.json(); throw new Error(err.error); }
  return res.json();
}

export async function deleteParticipantOrder(sessionId, participantName) {
  const res = await authFetch(`${API_URL}/sessions/${sessionId}/orders/${encodeURIComponent(participantName)}`, {
    method: 'DELETE'
  });
  if (!res.ok) { const err = await res.json(); throw new Error(err.error); }
  return res.json();
}

export async function editParticipantOrder(sessionId, participantName, items) {
  const res = await authFetch(`${API_URL}/sessions/${sessionId}/orders/${encodeURIComponent(participantName)}`, {
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

export async function fetchGoogleMenu(restaurantId, placeId) {
  const res = await fetch(`${API_URL}/admin/restaurants/${restaurantId}/fetch-google-menu`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ placeId })
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

export async function extractMenuFromPhotos(restaurantId, images) {
  const res = await fetch(`${API_URL}/admin/restaurants/${restaurantId}/extract-menu-from-photos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ images })
  });
  if (!res.ok) { const err = await res.json(); throw new Error(err.error); }
  return res.json();
}

/**
 * Try server-side photo download + Gemini first.
 * If that fails, download photos in the browser and send as base64.
 */
export async function autoExtractMenu(restaurantId, photoUrls) {
  // 1. Try server-side photo download
  try {
    return await extractMenuFromUrls(restaurantId, photoUrls);
  } catch (err) {
    console.log('Server download failed, trying browser download:', err.message);
  }

  // 2. Fallback: download in browser, send base64
  const images = [];
  for (const url of photoUrls.slice(0, 5)) {
    try {
      const resp = await fetch(url);
      if (!resp.ok) continue;
      const blob = await resp.blob();
      const base64 = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.readAsDataURL(blob);
      });
      images.push({ data: base64, mimeType: blob.type || 'image/jpeg' });
    } catch { /* skip failed downloads */ }
  }

  if (images.length > 0) {
    return await extractMenuFromPhotos(restaurantId, images);
  }

  throw new Error('No menu data found');
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
