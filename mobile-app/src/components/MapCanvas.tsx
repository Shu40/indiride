import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface MapCanvasProps {
  pickupLat?: number;
  pickupLng?: number;
  dropoffLat?: number;
  dropoffLng?: number;
  driverLat?: number;
  driverLng?: number;
  driverHeading?: number;
  routeGeometry?: [number, number][];
  driverToPickupRoute?: [number, number][];
  pickupEtaMins?: number;
  isDriverStale?: boolean;
  isFullScreen?: boolean;
  onToggleFullScreen?: () => void;
  onLocationPick?: (lat: number, lng: number) => void;
  radarRadiusKm?: number;
  vehicleCategory?: string;
  isSearching?: boolean;
}

export const MapCanvas: React.FC<MapCanvasProps> = ({
  pickupLat = 12.9716,
  pickupLng = 77.6412,
  dropoffLat,
  dropoffLng,
  driverLat,
  driverLng,
  driverHeading = 0,
  routeGeometry = [],
  driverToPickupRoute = [],
  pickupEtaMins = 3,
  isDriverStale = false,
  isFullScreen = false,
  onToggleFullScreen,
  onLocationPick,
  radarRadiusKm = 2.0,
  vehicleCategory = 'car',
  isSearching = false,
}) => {
  const iframeRef = useRef<any>(null);
  const [mapStyle, setMapStyle] = useState<'streets' | 'dark'>('streets');
  const isMapReadyRef = useRef(false);

  // Send state update to iframe without re-rendering or reloading Leaflet
  const postToMap = (msg: any) => {
    try {
      if (iframeRef.current && iframeRef.current.contentWindow) {
        iframeRef.current.contentWindow.postMessage(msg, '*');
      }
    } catch (e) {
      // ignore cross-origin frame access transient
    }
  };

  // Listen for messages from the Leaflet map (e.g. map click, map ready)
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const handleMessage = (event: MessageEvent) => {
        if (!event.data) return;
        if (event.data.type === 'MAP_READY') {
          isMapReadyRef.current = true;
          syncFullStateToMap();
        } else if (event.data.type === 'MAP_CLICK') {
          if (onLocationPick) {
            onLocationPick(event.data.lat, event.data.lng);
          }
        }
      };
      window.addEventListener('message', handleMessage);
      return () => {
        window.removeEventListener('message', handleMessage);
      };
    }
  }, [onLocationPick]);

  const syncFullStateToMap = () => {
    postToMap({
      type: 'SYNC_STATE',
      payload: {
        pickup: pickupLat && pickupLng ? [pickupLat, pickupLng] : null,
        dropoff: dropoffLat && dropoffLng ? [dropoffLat, dropoffLng] : null,
        driver: driverLat && driverLng ? {
          lat: driverLat,
          lng: driverLng,
          heading: driverHeading,
          category: vehicleCategory,
          eta: pickupEtaMins,
        } : null,
        routeGeometry,
        driverToPickupRoute,
        isSearching,
        radarRadiusKm,
        mapStyle,
      },
    });
  };

  // Real-time synchronization when props change (60fps smooth live updates without iframe reload)
  useEffect(() => {
    if (isMapReadyRef.current) {
      syncFullStateToMap();
    }
  }, [
    pickupLat,
    pickupLng,
    dropoffLat,
    dropoffLng,
    driverLat,
    driverLng,
    driverHeading,
    routeGeometry,
    driverToPickupRoute,
    isSearching,
    radarRadiusKm,
    vehicleCategory,
    mapStyle,
  ]);

  const handleRecenter = () => {
    const targetLat = driverLat || pickupLat;
    const targetLng = driverLng || pickupLng;
    postToMap({ type: 'FLY_TO', lat: targetLat, lng: targetLng, zoom: 15 });
  };

  const handleZoomIn = () => postToMap({ type: 'ZOOM_IN' });
  const handleZoomOut = () => postToMap({ type: 'ZOOM_OUT' });

  const handleToggleStyle = () => {
    const nextStyle = mapStyle === 'streets' ? 'dark' : 'streets';
    setMapStyle(nextStyle);
    postToMap({ type: 'SET_STYLE', style: nextStyle });
  };

  // Generate self-contained, high-performance HTML once on mount
  const initialMapHtml = useMemo(() => {
    const initCenterLat = pickupLat || 12.9716;
    const initCenterLng = pickupLng || 77.6412;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <style>
          * { box-sizing: border-box; }
          html, body { width: 100%; height: 100%; margin: 0; padding: 0; overflow: hidden; background: #e5e7eb; }
          #map { width: 100%; height: 100%; }

          /* Custom Interactive Pins */
          .camp-pickup-pin {
            display: flex;
            align-items: center;
            gap: 6px;
            background: #0f172a;
            color: #ffffff;
            border-radius: 20px;
            padding: 4px 10px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            font-size: 11px;
            font-weight: 700;
            box-shadow: 0 4px 14px rgba(0,0,0,0.35);
            border: 2px solid #ffffff;
            white-space: nowrap;
          }
          .green-dot {
            width: 8px;
            height: 8px;
            background: #10b981;
            border-radius: 50%;
            flex-shrink: 0;
            box-shadow: 0 0 8px #10b981;
          }

          .camp-drop-pin {
            display: flex;
            align-items: center;
            gap: 6px;
            background: #0f172a;
            color: #ffffff;
            border-radius: 20px;
            padding: 4px 10px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            font-size: 11px;
            font-weight: 700;
            box-shadow: 0 4px 14px rgba(0,0,0,0.35);
            border: 2px solid #ffffff;
            white-space: nowrap;
          }
          .red-square {
            width: 8px;
            height: 8px;
            background: #ef4444;
            border-radius: 2px;
            flex-shrink: 0;
            box-shadow: 0 0 8px #ef4444;
          }

          .assigned-driver-marker-wrapper {
            transition: transform 1.2s cubic-bezier(0.25, 1, 0.5, 1) !important;
          }

          .assigned-driver-marker-inner {
            background: #0f172a;
            color: #ffffff;
            width: 42px;
            height: 42px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 6px 18px rgba(16,185,129,0.5);
            border: 3px solid #10b981;
            font-size: 20px;
            transition: transform 0.6s cubic-bezier(0.2, 0.8, 0.2, 1);
          }

          .nearby-cab-marker {
            background: #1e293b;
            color: #ffffff;
            width: 32px;
            height: 32px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 3px 10px rgba(0,0,0,0.25);
            border: 2px solid #ffffff;
            font-size: 15px;
          }

          .radar-pulse {
            animation: pulseRadar 2s cubic-bezier(0.215, 0.61, 0.355, 1) infinite;
          }
          @keyframes pulseRadar {
            0% { opacity: 0.7; transform: scale(0.98); }
            50% { opacity: 0.2; transform: scale(1.02); }
            100% { opacity: 0.7; transform: scale(0.98); }
          }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script>
          // Initialize Leaflet Map
          var map = L.map('map', {
            zoomControl: false,
            attributionControl: false
          }).setView([${initCenterLat}, ${initCenterLng}], 14);

          // 1. High-Performance Global Tile Providers (Rock-solid, zero API keys required)
          var streetLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
            maxZoom: 19,
            subdomains: 'abcd'
          });

          var darkLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
            maxZoom: 19,
            subdomains: 'abcd'
          });

          // Fallback on tileerror to OSM France mirror
          function attachTileFallback(layer) {
            layer.on('tileerror', function(error, tile) {
              tile.src = 'https://tile.openstreetmap.fr/osmfr/' + error.coords.z + '/' + error.coords.x + '/' + error.coords.y + '.png';
            });
          }
          attachTileFallback(streetLayer);
          attachTileFallback(darkLayer);

          streetLayer.addTo(map);
          var currentTileLayer = streetLayer;

          // State markers & shapes
          var pickupMarker = null;
          var dropMarker = null;
          var driverMarker = null;
          var routeLine = null;
          var driverLine = null;
          var radarCircle = null;
          var nearbyMarkers = [];

          function getVehicleEmoji(category) {
            if (category === 'bike') return '🏍️';
            if (category === 'auto') return '🛺';
            if (category === 'bus') return '🚌';
            return '🚕';
          }

          function spawnNearbyVehicles(center) {
            nearbyMarkers.forEach(function(m) { map.removeLayer(m); });
            nearbyMarkers = [];
            var cabs = [
              { lat: center[0] + 0.0035, lng: center[1] + 0.0042, icon: '🚕' },
              { lat: center[0] - 0.0041, lng: center[1] + 0.0028, icon: '🏍️' },
              { lat: center[0] + 0.0022, lng: center[1] - 0.0051, icon: '🛺' },
              { lat: center[0] - 0.0031, lng: center[1] - 0.0039, icon: '🚌' }
            ];
            cabs.forEach(function(c) {
              var icon = L.divIcon({
                className: '',
                html: '<div class="nearby-cab-marker">' + c.icon + '</div>',
                iconSize: [32, 32],
                iconAnchor: [16, 16]
              });
              var m = L.marker([c.lat, c.lng], { icon: icon }).addTo(map);
              nearbyMarkers.push(m);
            });
          }

          // Initial nearby vehicles
          spawnNearbyVehicles([${initCenterLat}, ${initCenterLng}]);

          // Handle incoming state messages from React Native web parent
          window.addEventListener('message', function(e) {
            if (!e.data) return;
            var type = e.data.type;
            var p = e.data.payload;

            if (type === 'SYNC_STATE' && p) {
              // 1. Style
              if (p.mapStyle === 'dark' && currentTileLayer !== darkLayer) {
                map.removeLayer(currentTileLayer);
                darkLayer.addTo(map);
                currentTileLayer = darkLayer;
              } else if (p.mapStyle === 'streets' && currentTileLayer !== streetLayer) {
                map.removeLayer(currentTileLayer);
                streetLayer.addTo(map);
                currentTileLayer = streetLayer;
              }

              // 2. Pickup Pin
              if (p.pickup) {
                var pIcon = L.divIcon({
                  className: '',
                  html: '<div class="camp-pickup-pin"><div class="green-dot"></div>Pickup</div>',
                  iconSize: [85, 28],
                  iconAnchor: [42, 28]
                });
                if (!pickupMarker) {
                  pickupMarker = L.marker(p.pickup, { icon: pIcon }).addTo(map);
                } else {
                  pickupMarker.setLatLng(p.pickup);
                }
              } else if (pickupMarker) {
                map.removeLayer(pickupMarker);
                pickupMarker = null;
              }

              // 3. Dropoff Pin
              if (p.dropoff) {
                var dIcon = L.divIcon({
                  className: '',
                  html: '<div class="camp-drop-pin"><div class="red-square"></div>Destination</div>',
                  iconSize: [110, 28],
                  iconAnchor: [55, 28]
                });
                if (!dropMarker) {
                  dropMarker = L.marker(p.dropoff, { icon: dIcon }).addTo(map);
                } else {
                  dropMarker.setLatLng(p.dropoff);
                }
              } else if (dropMarker) {
                map.removeLayer(dropMarker);
                dropMarker = null;
              }

              // 4. Assigned Driver Marker
              if (p.driver) {
                // Clear simulated nearby cabs once driver is assigned
                nearbyMarkers.forEach(function(m) { map.removeLayer(m); });
                nearbyMarkers = [];

                var emoji = getVehicleEmoji(p.driver.category);
                var heading = p.driver.heading || 0;
                var drvIcon = L.divIcon({
                  className: 'assigned-driver-marker-wrapper',
                  html: '<div class="assigned-driver-marker-inner" style="transform: rotate(' + heading + 'deg);">' + emoji + '</div>',
                  iconSize: [42, 42],
                  iconAnchor: [21, 21]
                });

                if (!driverMarker) {
                  driverMarker = L.marker([p.driver.lat, p.driver.lng], { icon: drvIcon }).addTo(map);
                } else {
                  driverMarker.setLatLng([p.driver.lat, p.driver.lng]);
                  driverMarker.setIcon(drvIcon);
                }
              } else if (driverMarker) {
                map.removeLayer(driverMarker);
                driverMarker = null;
                if (p.pickup) spawnNearbyVehicles(p.pickup);
              }

              // 5. Radar Pulse Circle
              if (p.isSearching && p.pickup) {
                var radiusM = (p.radarRadiusKm || 2.0) * 1000;
                if (!radarCircle) {
                  radarCircle = L.circle(p.pickup, {
                    radius: radiusM,
                    color: '#10b981',
                    fillColor: '#10b981',
                    fillOpacity: 0.12,
                    weight: 2,
                    className: 'radar-pulse'
                  }).addTo(map);
                } else {
                  radarCircle.setLatLng(p.pickup);
                  radarCircle.setRadius(radiusM);
                }
              } else if (radarCircle) {
                map.removeLayer(radarCircle);
                radarCircle = null;
              }

              // 6. Driver-to-Pickup Polyline
              if (p.driverToPickupRoute && p.driverToPickupRoute.length > 0) {
                if (!driverLine) {
                  driverLine = L.polyline(p.driverToPickupRoute, {
                    color: '#10b981',
                    weight: 5,
                    opacity: 0.95,
                    lineJoin: 'round'
                  }).addTo(map);
                } else {
                  driverLine.setLatLngs(p.driverToPickupRoute);
                }
              } else if (driverLine) {
                map.removeLayer(driverLine);
                driverLine = null;
              }

              // 7. Route Polyline to Destination
              if (p.routeGeometry && p.routeGeometry.length > 0) {
                if (!routeLine) {
                  routeLine = L.polyline(p.routeGeometry, {
                    color: '#0f172a',
                    weight: 6,
                    opacity: 0.9,
                    lineJoin: 'round'
                  }).addTo(map);
                } else {
                  routeLine.setLatLngs(p.routeGeometry);
                }
                map.fitBounds(routeLine.getBounds(), { padding: [60, 60], maxZoom: 16 });
              } else if (routeLine) {
                map.removeLayer(routeLine);
                routeLine = null;
                if (p.pickup && p.driver) {
                  var group = new L.featureGroup([pickupMarker, driverMarker]);
                  map.fitBounds(group.getBounds(), { padding: [60, 60], maxZoom: 16 });
                }
              }
            } else if (type === 'FLY_TO') {
              map.flyTo([e.data.lat, e.data.lng], e.data.zoom || 15, { duration: 0.8 });
            } else if (type === 'ZOOM_IN') {
              map.zoomIn();
            } else if (type === 'ZOOM_OUT') {
              map.zoomOut();
            } else if (type === 'SET_STYLE') {
              if (e.data.style === 'dark' && currentTileLayer !== darkLayer) {
                map.removeLayer(currentTileLayer);
                darkLayer.addTo(map);
                currentTileLayer = darkLayer;
              } else if (e.data.style === 'streets' && currentTileLayer !== streetLayer) {
                map.removeLayer(currentTileLayer);
                streetLayer.addTo(map);
                currentTileLayer = streetLayer;
              }
            }
          });

          // Click to pick location
          map.on('click', function(e) {
            window.parent.postMessage({ type: 'MAP_CLICK', lat: e.latlng.lat, lng: e.latlng.lng }, '*');
          });

          // Notify parent that map is fully loaded and ready
          window.parent.postMessage({ type: 'MAP_READY' }, '*');
        </script>
      </body>
      </html>
    `;
  }, []);

  if (Platform.OS === 'web') {
    return (
      <View style={styles.webWrapper}>
        <iframe
          ref={iframeRef}
          title="Live Ride Map"
          style={{ width: '100%', height: '100%', border: 'none' }}
          srcDoc={initialMapHtml}
        />

        {/* Floating Map Controls */}
        <View style={styles.floatingControls}>
          {onToggleFullScreen && (
            <TouchableOpacity
              style={styles.controlPill}
              onPress={onToggleFullScreen}
              accessibilityLabel="Toggle Fullscreen"
            >
              <Ionicons name={isFullScreen ? 'contract' : 'expand'} size={18} color="#0f172a" />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.controlPill}
            onPress={handleToggleStyle}
            accessibilityLabel="Toggle Map Style"
          >
            <Ionicons name={mapStyle === 'streets' ? 'moon' : 'sunny'} size={18} color="#0f172a" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.controlPill}
            onPress={handleZoomIn}
            accessibilityLabel="Zoom In"
          >
            <Ionicons name="add" size={20} color="#0f172a" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.controlPill}
            onPress={handleZoomOut}
            accessibilityLabel="Zoom Out"
          >
            <Ionicons name="remove" size={20} color="#0f172a" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.controlPill, styles.recenterPill]}
            onPress={handleRecenter}
            accessibilityLabel="Recenter Map"
          >
            <Ionicons name="navigate" size={18} color="#10b981" />
          </TouchableOpacity>
        </View>

        {/* Live Driver Tracking Badge */}
        {driverLat && driverLng && (
          <View style={[styles.driverLiveBadge, isDriverStale && styles.driverStaleBadge]}>
            <View style={[styles.greenLiveDot, isDriverStale && styles.amberLiveDot]} />
            <Text style={styles.driverLiveText}>
              {isDriverStale
                ? 'Driver GPS paused • Reconnecting...'
                : `Driver en route • ~${pickupEtaMins || 3} mins`}
            </Text>
          </View>
        )}
      </View>
    );
  }

  // Native fallback
  return (
    <View style={styles.webWrapper}>
      <View style={styles.nativeMapPlaceholder}>
        <Ionicons name="map" size={48} color="#9ca3af" />
        <Text style={styles.nativeMapTitle}>Live Route Map</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  webWrapper: {
    width: '100%',
    height: '100%',
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#e5e7eb',
  },
  floatingControls: {
    position: 'absolute',
    top: 16,
    right: 16,
    gap: 8,
    zIndex: 9999,
  },
  controlPill: {
    backgroundColor: '#ffffff',
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 3px 10px rgba(0, 0, 0, 0.15)' }
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.15,
          shadowRadius: 5,
        }),
  },
  recenterPill: {
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#10b981',
  },
  driverLiveBadge: {
    position: 'absolute',
    top: 16,
    left: 16,
    backgroundColor: '#0f172a',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    elevation: 5,
    zIndex: 9999,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 4px 14px rgba(0, 0, 0, 0.25)' }
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.25,
          shadowRadius: 6,
        }),
  },
  driverStaleBadge: {
    backgroundColor: '#78350f',
  },
  greenLiveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10b981',
  },
  amberLiveDot: {
    backgroundColor: '#f59e0b',
  },
  driverLiveText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  nativeMapPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nativeMapTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#374151',
    marginTop: 8,
  },
});
