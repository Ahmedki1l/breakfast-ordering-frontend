import React, { useEffect, useRef, useState } from 'react';

/**
 * GoogleMapPicker — Interactive Google Map with Places Autocomplete.
 * When a place is selected, calls onPlaceSelect with:
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
  const [map, setMap] = useState(null);
  const [marker, setMarker] = useState(null);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);

  // Default to Cairo, Egypt
  const center = defaultCenter || { lat: 30.0444, lng: 31.2357 };

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
        zoom: 13,
        styles: darkMapStyle,
        disableDefaultUI: false,
        zoomControl: true,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      });

      const gMarker = new window.google.maps.Marker({
        map: gMap,
        visible: false,
        animation: window.google.maps.Animation.DROP,
      });

      // Places Autocomplete
      const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
        types: ['establishment'],
        fields: ['name', 'formatted_address', 'formatted_phone_number', 'geometry', 'place_id', 'url', 'website'],
      });

      autocomplete.bindTo('bounds', gMap);

      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        if (!place.geometry?.location) return;

        // Center map and show marker
        gMap.setCenter(place.geometry.location);
        gMap.setZoom(17);
        gMarker.setPosition(place.geometry.location);
        gMarker.setVisible(true);

        // Notify parent
        onPlaceSelect?.({
          name: place.name || '',
          address: place.formatted_address || '',
          phone: place.formatted_phone_number || '',
          googleMapsUrl: place.url || `https://www.google.com/maps/place/?q=place_id:${place.place_id}`,
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
        });
      });

      // Click on map to search nearby
      gMap.addListener('click', (e) => {
        gMarker.setPosition(e.latLng);
        gMarker.setVisible(true);

        // Reverse geocode / find nearby places
        const service = new window.google.maps.places.PlacesService(gMap);
        service.nearbySearch(
          { location: e.latLng, radius: 50, type: 'restaurant' },
          (results, status) => {
            if (status === window.google.maps.places.PlacesServiceStatus.OK && results[0]) {
              // Get full details of the first result
              service.getDetails(
                { placeId: results[0].place_id, fields: ['name', 'formatted_address', 'formatted_phone_number', 'geometry', 'place_id', 'url'] },
                (detail, detStatus) => {
                  if (detStatus === window.google.maps.places.PlacesServiceStatus.OK && detail) {
                    gMap.setCenter(detail.geometry.location);
                    gMarker.setPosition(detail.geometry.location);
                    if (inputRef.current) inputRef.current.value = detail.name;
                    onPlaceSelect?.({
                      name: detail.name || '',
                      address: detail.formatted_address || '',
                      phone: detail.formatted_phone_number || '',
                      googleMapsUrl: detail.url || `https://www.google.com/maps/place/?q=place_id:${detail.place_id}`,
                      lat: detail.geometry.location.lat(),
                      lng: detail.geometry.location.lng(),
                    });
                  }
                }
              );
            }
          }
        );
      });

      setMap(gMap);
      setMarker(gMarker);
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
        🗺️ Search on Google Maps
      </label>
      <input
        ref={inputRef}
        className="form-input"
        placeholder="Search for a restaurant..."
        style={{ marginBottom: 12 }}
      />
      <div
        ref={mapRef}
        style={{
          width: '100%',
          height: 300,
          borderRadius: 12,
          border: '1px solid var(--border)',
          overflow: 'hidden',
          background: 'var(--bg-card)',
        }}
      />
      {!ready && (
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
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2a2a4a' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#6b6b8a' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3a3a5a' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#2a2a4a' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e1a2e' }] },
];
