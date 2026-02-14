import React, { useEffect, useRef, useState, useCallback } from 'react';

/**
 * GoogleMapPicker — uses the NEW Places API (not legacy).
 * Custom autocomplete with restaurant/cafe filtering.
 * Auto-fills form on search selection or POI map click.
 */

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

let mapsLoadingPromise = null;

function loadGoogleMapsCore() {
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
  const mapObjRef = useRef(null);
  const markerRef = useRef(null);
  const libsRef = useRef(null); // { Place, AutocompleteSuggestion, ... }
  const debounceRef = useRef(null);

  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedName, setSelectedName] = useState('');
  const [loadingDetails, setLoadingDetails] = useState(false);

  const center = defaultCenter || { lat: 30.0444, lng: 31.2357 };

  // ============ Select a place by ID ============
  const selectPlaceById = useCallback(async (placeId) => {
    const libs = libsRef.current;
    if (!libs) return;

    setLoadingDetails(true);
    try {
      const place = new libs.Place({ id: placeId });
      await place.fetchFields({
        fields: ['displayName', 'formattedAddress', 'nationalPhoneNumber',
          'internationalPhoneNumber', 'location', 'googleMapsURI', 'photos']
      });

      if (!place.location) return;

      const gMap = mapObjRef.current;
      const gMarker = markerRef.current;

      gMap.setCenter(place.location);
      gMap.setZoom(17);
      gMarker.setPosition(place.location);
      gMarker.setVisible(true);

      const name = place.displayName || '';
      setSelectedName(name);
      setQuery(name);
      setSuggestions([]);
      setShowDropdown(false);

      // Get photo URLs (up to 5 photos for menu extraction)
      const photoUrls = (place.photos || []).slice(0, 5).map(photo => {
        try {
          return photo.getURI({ maxWidth: 800 });
        } catch {
          return null;
        }
      }).filter(Boolean);

      onPlaceSelect?.({
        name,
        placeId,
        address: place.formattedAddress || '',
        phone: place.nationalPhoneNumber || place.internationalPhoneNumber || '',
        googleMapsUrl: place.googleMapsURI || `https://www.google.com/maps/place/?q=place_id:${placeId}`,
        photoUrls,
      });
    } catch (err) {
      console.error('Place details error:', err);
    } finally {
      setLoadingDetails(false);
    }
  }, [onPlaceSelect]);

  // ============ Search Suggestions ============
  const fetchSuggestions = useCallback(async (input) => {
    const libs = libsRef.current;
    if (!libs || !input.trim()) {
      setSuggestions([]);
      return;
    }

    try {
      const request = {
        input: input.trim(),
        includedPrimaryTypes: ['restaurant', 'cafe', 'bakery', 'meal_takeaway', 'meal_delivery'],
        language: 'en',
      };

      // Add location bias if map is available
      const gMap = mapObjRef.current;
      if (gMap) {
        const mapCenter = gMap.getCenter();
        request.locationBias = {
          center: { lat: mapCenter.lat(), lng: mapCenter.lng() },
          radius: 10000,
        };
      }

      const result = await libs.AutocompleteSuggestion.fetchAutocompleteSuggestions(request);

      const items = (result.suggestions || []).map(s => ({
        placeId: s.placePrediction.placeId,
        mainText: s.placePrediction.mainText?.text || '',
        secondaryText: s.placePrediction.secondaryText?.text || '',
        fullText: s.placePrediction.text?.text || '',
      }));

      setSuggestions(items);
      setShowDropdown(items.length > 0);
    } catch (err) {
      console.error('Autocomplete error:', err);
      setSuggestions([]);
    }
  }, []);

  const handleInputChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    setSelectedName('');

    // Debounce
    clearTimeout(debounceRef.current);
    if (!val.trim()) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }
    debounceRef.current = setTimeout(() => fetchSuggestions(val), 300);
  };

  const handleSuggestionClick = (suggestion) => {
    selectPlaceById(suggestion.placeId);
  };

  // ============ Init Map ============
  useEffect(() => {
    if (!GOOGLE_MAPS_API_KEY) {
      setError('Add VITE_GOOGLE_MAPS_API_KEY to frontend/.env');
      return;
    }

    let cancelled = false;

    loadGoogleMapsCore().then(() => {
      if (cancelled || !mapRef.current) return;

      // Access classes directly (loaded via libraries=places)
      const PlaceClass = google.maps.places.Place;
      const AutocompleteSuggestionClass = google.maps.places.AutocompleteSuggestion;

      libsRef.current = {
        Place: PlaceClass,
        AutocompleteSuggestion: AutocompleteSuggestionClass,
      };

      const gMap = new google.maps.Map(mapRef.current, {
        center,
        zoom: 14,
        styles: darkMapStyle,
        disableDefaultUI: false,
        zoomControl: true,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        clickableIcons: true,
      });

      const gMarker = new google.maps.Marker({
        map: gMap,
        visible: false,
        animation: google.maps.Animation.DROP,
      });

      mapObjRef.current = gMap;
      markerRef.current = gMarker;

      // Handle POI clicks on the map
      gMap.addListener('click', (e) => {
        if (e.placeId) {
          e.stop(); // Prevent default info window
          selectPlaceById(e.placeId);
        }
      });

      // Try to center on user's location
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => gMap.setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
          () => {}
        );
      }

      setReady(true);
    }).catch(err => {
      setError(err.message);
    });

    return () => { cancelled = true; };
  }, []);

  // ============ Render ============
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

      {/* Custom Autocomplete */}
      <div style={{ position: 'relative', marginBottom: 12 }}>
        <input
          className="form-input"
          placeholder="Type a restaurant name..."
          value={query}
          onChange={handleInputChange}
          onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
          onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
        />
        {loadingDetails && (
          <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', fontSize: '0.9rem' }}>⏳</span>
        )}

        {/* Suggestions Dropdown */}
        {showDropdown && suggestions.length > 0 && (
          <div style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            background: '#1e293b',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8,
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            zIndex: 1000,
            maxHeight: 260,
            overflowY: 'auto',
            marginTop: 4,
          }}>
            {suggestions.map((s, i) => (
              <div
                key={s.placeId || i}
                onClick={() => handleSuggestionClick(s)}
                style={{
                  padding: '10px 14px',
                  cursor: 'pointer',
                  borderTop: i > 0 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                  transition: 'background 150ms ease',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,0.15)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{ color: '#e2e8f0', fontWeight: 600, fontSize: '0.9rem' }}>
                  🍽️ {s.mainText}
                </div>
                {s.secondaryText && (
                  <div style={{ color: '#94a3b8', fontSize: '0.8rem', marginTop: 2 }}>
                    {s.secondaryText}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Map */}
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

      {/* Selection Confirmation */}
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

      <p style={{ color: 'var(--text-dim)', fontSize: '0.75rem', marginTop: 8, textAlign: 'center' }}>
        💡 Type to search, or click any restaurant icon on the map
      </p>
    </div>
  );
}

// Dark map style — hides non-food POIs
const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#1a1a2e' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8b8ba7' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a1a2e' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#6366f1' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#1a2a1e' }] },
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
