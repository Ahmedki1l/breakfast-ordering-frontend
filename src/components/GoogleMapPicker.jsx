import React, { useEffect, useRef, useState } from 'react';

/**
 * GoogleMapPicker — Interactive Google Map with Places Autocomplete.
 * Restricted to restaurants & cafes only.
 * When a place is selected (via search or map click), calls onPlaceSelect with:
 * { name, address, phone, googleMapsUrl, lat, lng }
 *
 * Requires VITE_GOOGLE_MAPS_API_KEY in .env
 */

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

let mapsLoadingPromise = null;

function loadGoogleMaps() {
  if (window.google?.maps?.places) return Promise.resolve();
  if (mapsLoadingPromise) return mapsLoadingPromise;

  mapsLoadingPromise = new Promise((resolve, reject) => {
    if (!GOOGLE_MAPS_API_KEY) {
      reject(new Error('Google Maps API key not configured'));
      return;
    }
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places&callback=__gmapsInit`;
    script.async = true;
    script.defer = true;
    window.__gmapsInit = () => {
      delete window.__gmapsInit;
      resolve();
    };
    script.onerror = () => reject(new Error('Failed to load Google Maps'));
    document.head.appendChild(script);
  });

  return mapsLoadingPromise;
}

export default function GoogleMapPicker({ onPlaceSelect, defaultCenter }) {
  const mapRef = useRef(null);
  const inputRef = useRef(null);
  const mapObjRef = useRef(null);
  const markerRef = useRef(null);
  const serviceRef = useRef(null);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [selectedName, setSelectedName] = useState('');

  // Default to Cairo, Egypt
  const center = defaultCenter || { lat: 30.0444, lng: 31.2357 };

  // Extract place details and notify parent
  const handlePlaceDetails = (place) => {
    if (!place || !place.geometry?.location) return;

    const gMap = mapObjRef.current;
    const gMarker = markerRef.current;

    // Center map and show marker
    gMap.setCenter(place.geometry.location);
    gMap.setZoom(17);
    gMarker.setPosition(place.geometry.location);
    gMarker.setVisible(true);

    const name = place.name || '';
    setSelectedName(name);
    if (inputRef.current) inputRef.current.value = name;

    // Notify parent with all extracted data
    onPlaceSelect?.({
      name,
      address: place.formatted_address || place.vicinity || '',
      phone: place.formatted_phone_number || place.international_phone_number || '',
      googleMapsUrl: place.url || `https://www.google.com/maps/place/?q=place_id:${place.place_id}`,
      lat: place.geometry.location.lat(),
      lng: place.geometry.location.lng(),
    });
  };

  // Get full details for a place ID
  const getPlaceDetails = (placeId) => {
    const service = serviceRef.current;
    if (!service) return;

    service.getDetails(
      {
        placeId,
        fields: [
          'name', 'formatted_address', 'formatted_phone_number',
          'international_phone_number', 'geometry', 'place_id',
          'url', 'types', 'vicinity'
        ]
      },
      (place, status) => {
        if (status === window.google.maps.places.PlacesServiceStatus.OK && place) {
          handlePlaceDetails(place);
        }
      }
    );
  };

  useEffect(() => {
    if (!GOOGLE_MAPS_API_KEY) {
      setError('Add VITE_GOOGLE_MAPS_API_KEY to frontend/.env');
      return;
    }

    let cancelled = false;

    loadGoogleMaps().then(() => {
      if (cancelled || !mapRef.current) return;

      const gMap = new window.google.maps.Map(mapRef.current, {
        center,
        zoom: 14,
        styles: darkMapStyle,
        disableDefaultUI: false,
        zoomControl: true,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        clickableIcons: true, // Keep POI icons visible
      });

      const gMarker = new window.google.maps.Marker({
        map: gMap,
        visible: false,
        animation: window.google.maps.Animation.DROP,
      });

      const placesService = new window.google.maps.places.PlacesService(gMap);

      mapObjRef.current = gMap;
      markerRef.current = gMarker;
      serviceRef.current = placesService;

      // === Search Autocomplete (restaurants & cafes only) ===
      const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
        types: ['establishment'],
        fields: [
          'name', 'formatted_address', 'formatted_phone_number',
          'international_phone_number', 'geometry', 'place_id',
          'url', 'types', 'vicinity'
        ],
      });

      autocomplete.bindTo('bounds', gMap);

      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        handlePlaceDetails(place);
      });

      // === Click on a POI (restaurant icon on the map) ===
      // When clicking a POI, the event has a placeId property
      gMap.addListener('click', (e) => {
        if (e.placeId) {
          // Prevent default Google Maps info window
          e.stop();
          // Get full details for this place
          getPlaceDetails(e.placeId);
        }
      });

      // Try to center on user's location
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const userLoc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            gMap.setCenter(userLoc);
          },
          () => {} // Silently fail
        );
      }

      setReady(true);
    }).catch(err => {
      setError(err.message);
    });

    return () => { cancelled = true; };
  }, []);

  if (error) {
    return (
      <div style={{
        padding: 20,
        background: 'rgba(239, 68, 68, 0.08)',
        border: '1px solid rgba(239, 68, 68, 0.25)',
        borderRadius: 12,
        marginBottom: 20,
        textAlign: 'center',
        color: 'var(--danger)',
      }}>
        <p style={{ marginBottom: 8, fontWeight: 600 }}>⚠️ Google Maps not available</p>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{error}</p>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 20 }}>
      <label style={{ display: 'block', marginBottom: 6, fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-muted)' }}>
        🗺️ Search for a restaurant or cafe
      </label>
      <input
        ref={inputRef}
        className="form-input"
        placeholder="Type a restaurant name..."
        style={{ marginBottom: 12 }}
      />
      <div
        ref={mapRef}
        style={{
          width: '100%',
          height: 350,
          borderRadius: 12,
          border: '1px solid var(--border)',
          overflow: 'hidden',
          background: 'var(--bg-card)',
        }}
      />
      {selectedName && (
        <div style={{
          marginTop: 10,
          padding: '8px 14px',
          background: 'rgba(99, 102, 241, 0.1)',
          border: '1px solid rgba(99, 102, 241, 0.25)',
          borderRadius: 8,
          color: 'var(--primary-light)',
          fontSize: '0.85rem',
        }}>
          ✅ Selected: <strong>{selectedName}</strong> — fields auto-filled below
        </div>
      )}
      {!ready && !error && (
        <p style={{ textAlign: 'center', color: 'var(--text-dim)', marginTop: 8, fontSize: '0.85rem' }}>
          Loading map...
        </p>
      )}
    </div>
  );
}

// Dark-themed map style to match the UI
const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#1a1a2e' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8b8ba7' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a1a2e' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#6366f1' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#1a2a1e' }] },
  // Hide non-food POIs to reduce clutter
  { featureType: 'poi.attraction', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.government', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.medical', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.place_of_worship', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.school', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.sports_complex', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2a2a4a' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#6b6b8a' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3a3a5a' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#2a2a4a' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e1a2e' }] },
];
