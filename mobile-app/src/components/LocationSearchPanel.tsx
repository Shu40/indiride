import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../services/api';
import { PlaceSuggestion } from '../types';

interface LocationSearchPanelProps {
  activeField: 'pickup' | 'destination';
  pickup: { address: string; latitude: number; longitude: number } | null;
  destination: { address: string; latitude: number; longitude: number } | null;
  onSelectPickup: (location: { address: string; latitude: number; longitude: number }) => void;
  onSelectDestination: (location: { address: string; latitude: number; longitude: number }) => void;
  onSwitchField: (field: 'pickup' | 'destination') => void;
  onClose: () => void;
  onSwapLocations?: () => void;
}

const POPULAR_INDIAN_DESTINATIONS = [
  { name: 'Indiranagar 100 Feet Rd', city: 'Bengaluru, Karnataka', lat: 12.9716, lng: 77.6412, icon: 'business' },
  { name: 'Koramangala 5th Block', city: 'Bengaluru, Karnataka', lat: 12.9352, lng: 77.6245, icon: 'restaurant' },
  { name: 'Kempegowda Int. Airport (BLR)', city: 'Devanahalli, Bengaluru', lat: 13.1986, lng: 77.7066, icon: 'airplane' },
  { name: 'MG Road Metro Station', city: 'Bengaluru, Karnataka', lat: 12.9754, lng: 77.6066, icon: 'subway' },
  { name: 'Parul University Campus', city: 'Vadodara, Gujarat', lat: 22.2887, lng: 73.3634, icon: 'school' },
  { name: 'Alkapuri Railway Station', city: 'Vadodara, Gujarat', lat: 22.3107, lng: 73.1812, icon: 'subway' },
  { name: 'Connaught Place (CP)', city: 'New Delhi, Delhi', lat: 28.6315, lng: 77.2167, icon: 'business' },
  { name: 'Cyber Hub Gurgaon', city: 'Gurugram, Haryana', lat: 28.4952, lng: 77.0886, icon: 'business' },
  { name: 'Bandra Kurla Complex (BKC)', city: 'Mumbai, Maharashtra', lat: 19.0662, lng: 72.8682, icon: 'briefcase' },
  { name: 'Hitec City / Cyber Towers', city: 'Hyderabad, Telangana', lat: 17.4504, lng: 78.3808, icon: 'business' },
];

export const LocationSearchPanel: React.FC<LocationSearchPanelProps> = ({
  activeField,
  pickup,
  destination,
  onSelectPickup,
  onSelectDestination,
  onSwitchField,
  onClose,
  onSwapLocations,
}) => {
  const [pickupText, setPickupText] = useState(pickup?.address || '');
  const [destText, setDestText] = useState(destination?.address || '');
  const [results, setResults] = useState<PlaceSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [detectingGps, setDetectingGps] = useState(false);

  const pickupInputRef = useRef<TextInput>(null);
  const destInputRef = useRef<TextInput>(null);
  const searchSeqRef = useRef(0);

  // Sync external prop updates
  useEffect(() => {
    if (pickup?.address && pickup.address !== pickupText) {
      setPickupText(pickup.address);
    }
  }, [pickup?.address]);

  useEffect(() => {
    if (destination?.address && destination.address !== destText) {
      setDestText(destination.address);
    }
  }, [destination?.address]);

  // Focus the active field input
  useEffect(() => {
    const timer = setTimeout(() => {
      if (activeField === 'pickup') {
        pickupInputRef.current?.focus();
      } else {
        destInputRef.current?.focus();
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [activeField]);

  // Active query depends on which field is currently selected
  const activeQuery = activeField === 'pickup' ? pickupText : destText;

  // Debounced search
  useEffect(() => {
    const cleanQuery = activeQuery.trim();
    if (cleanQuery.length >= 2) {
      const seq = ++searchSeqRef.current;
      setLoading(true);
      const delay = setTimeout(async () => {
        try {
          const resp = await api.location.searchPlaces(cleanQuery, 10);
          if (seq === searchSeqRef.current) {
            setResults(resp.suggestions || []);
          }
        } catch (e) {
          if (seq === searchSeqRef.current) {
            const qLower = cleanQuery.toLowerCase();
            const localMatches: PlaceSuggestion[] = POPULAR_INDIAN_DESTINATIONS
              .filter(p => p.name.toLowerCase().includes(qLower) || p.city.toLowerCase().includes(qLower))
              .map((p, idx) => ({
                place_id: `local_${idx}`,
                name: p.name,
                formatted_address: `${p.name}, ${p.city}`,
                latitude: p.lat,
                longitude: p.lng,
                type: 'locality'
              }));
            setResults(localMatches);
          }
        } finally {
          if (seq === searchSeqRef.current) {
            setLoading(false);
          }
        }
      }, 250);

      return () => clearTimeout(delay);
    } else {
      searchSeqRef.current++;
      setResults([]);
      setLoading(false);
    }
  }, [activeQuery, activeField]);

  // Detect GPS
  const handleUseCurrentLocation = async () => {
    setDetectingGps(true);
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            const { latitude, longitude } = pos.coords;
            try {
              const geo = await api.location.reverseGeocode(latitude, longitude);
              const loc = { address: geo.address, latitude, longitude };
              if (activeField === 'pickup') {
                setPickupText(geo.address);
                onSelectPickup(loc);
                if (!destination) {
                  onSwitchField('destination');
                  destInputRef.current?.focus();
                }
              } else {
                setDestText(geo.address);
                onSelectDestination(loc);
                onClose();
              }
            } catch (err) {
              const addr = `Current Location (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`;
              const loc = { address: addr, latitude, longitude };
              if (activeField === 'pickup') {
                setPickupText(addr);
                onSelectPickup(loc);
                if (!destination) {
                  onSwitchField('destination');
                  destInputRef.current?.focus();
                }
              } else {
                setDestText(addr);
                onSelectDestination(loc);
                onClose();
              }
            } finally {
              setDetectingGps(false);
            }
          },
          (err) => {
            setDetectingGps(false);
            Alert.alert(
              'Location Access',
              'Unable to detect GPS position. Please enter your location manually or select from the list below.'
            );
          },
          { enableHighAccuracy: true, timeout: 8000 }
        );
      } else {
        setDetectingGps(false);
        Alert.alert('GPS Unavailable', 'Geolocation is not supported by your browser.');
      }
    } catch (e) {
      setDetectingGps(false);
    }
  };

  const handleSelectLocation = (loc: { address: string; latitude: number; longitude: number }) => {
    if (activeField === 'pickup') {
      setPickupText(loc.address);
      onSelectPickup(loc);
      if (!destination) {
        onSwitchField('destination');
        destInputRef.current?.focus();
      } else {
        onClose();
      }
    } else {
      setDestText(loc.address);
      onSelectDestination(loc);
      onClose();
    }
  };

  const handleSwap = () => {
    if (onSwapLocations) {
      onSwapLocations();
    }
    const temp = pickupText;
    setPickupText(destText);
    setDestText(temp);
  };

  return (
    <View style={styles.container}>
      {/* Header with Back Button */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {activeField === 'pickup' ? 'Enter Pickup Location' : 'Enter Destination'}
        </Text>
        <TouchableOpacity onPress={onClose} style={styles.closeTextBtn}>
          <Text style={styles.closeText}>Done</Text>
        </TouchableOpacity>
      </View>

      {/* Connected Dual Inputs Card */}
      <View style={styles.inputWrapper}>
        <View style={styles.connectorCol}>
          <View style={[styles.dotCircle, activeField === 'pickup' && styles.activeDotCircle]} />
          <View style={styles.connectorLine} />
          <View style={[styles.squareBox, activeField === 'destination' && styles.activeSquareBox]} />
        </View>

        <View style={styles.fieldsCol}>
          {/* Pickup Field */}
          <View style={[styles.inputBox, activeField === 'pickup' && styles.activeInputBox]}>
            <TextInput
              ref={pickupInputRef}
              style={styles.textInput}
              placeholder="Search pickup location in India..."
              placeholderTextColor="#94a3b8"
              value={pickupText}
              onChangeText={(text) => {
                setPickupText(text);
                if (activeField !== 'pickup') onSwitchField('pickup');
              }}
              onFocus={() => onSwitchField('pickup')}
            />
            {pickupText.length > 0 && (
              <TouchableOpacity onPress={() => setPickupText('')} style={styles.clearBtn}>
                <Ionicons name="close-circle" size={18} color="#94a3b8" />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.fieldSpacer} />

          {/* Destination Field */}
          <View style={[styles.inputBox, activeField === 'destination' && styles.activeInputBox]}>
            <TextInput
              ref={destInputRef}
              style={styles.textInput}
              placeholder="Where to in India? (Enter destination)"
              placeholderTextColor="#94a3b8"
              value={destText}
              onChangeText={(text) => {
                setDestText(text);
                if (activeField !== 'destination') onSwitchField('destination');
              }}
              onFocus={() => onSwitchField('destination')}
            />
            {destText.length > 0 && (
              <TouchableOpacity onPress={() => setDestText('')} style={styles.clearBtn}>
                <Ionicons name="close-circle" size={18} color="#94a3b8" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Swap Button on the right */}
        <TouchableOpacity style={styles.swapBtn} onPress={handleSwap} activeOpacity={0.7} accessibilityLabel="Swap Locations">
          <Ionicons name="swap-vertical" size={20} color="#0f172a" />
        </TouchableOpacity>
      </View>

      {/* Quick Action: Use Current GPS */}
      <TouchableOpacity
        style={styles.gpsActionRow}
        onPress={handleUseCurrentLocation}
        disabled={detectingGps}
        activeOpacity={0.7}
      >
        <View style={styles.gpsIconCircle}>
          {detectingGps ? (
            <ActivityIndicator size="small" color="#10b981" />
          ) : (
            <Ionicons name="navigate" size={18} color="#10b981" />
          )}
        </View>
        <View style={styles.gpsTextCol}>
          <Text style={styles.gpsActionTitle}>Use Current GPS Location</Text>
          <Text style={styles.gpsActionSub}>Auto-detect using device GPS</Text>
        </View>
      </TouchableOpacity>

      {/* Map Pin Hint */}
      <View style={styles.mapHintBanner}>
        <Ionicons name="map-outline" size={16} color="#64748b" />
        <Text style={styles.mapHintText}>
          Or tap directly on the map to set {activeField === 'pickup' ? 'pickup' : 'destination'}
        </Text>
      </View>

      {/* Suggestions or Popular Landmarks List */}
      <View style={styles.listContainer}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#000000" />
            <Text style={styles.loadingText}>Searching locations in India...</Text>
          </View>
        ) : activeQuery.trim().length >= 2 ? (
          <FlatList
            data={results}
            keyExtractor={(item) => item.place_id}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.resultRow}
                onPress={() =>
                  handleSelectLocation({
                    address: item.formatted_address,
                    latitude: item.latitude,
                    longitude: item.longitude,
                  })
                }
              >
                <View style={styles.resultIconBg}>
                  <Ionicons name="location-sharp" size={18} color="#0f172a" />
                </View>
                <View style={styles.resultTextCol}>
                  <Text style={styles.resultName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.resultAddress} numberOfLines={2}>
                    {item.formatted_address}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No matching locations found in India.</Text>
                <Text style={styles.emptySubText}>Try searching city, area or landmark</Text>
              </View>
            }
          />
        ) : (
          <FlatList
            data={POPULAR_INDIAN_DESTINATIONS}
            keyExtractor={(item, idx) => `pop_${idx}`}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={
              <Text style={styles.sectionHeader}>POPULAR DESTINATIONS IN INDIA</Text>
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.resultRow}
                onPress={() =>
                  handleSelectLocation({
                    address: `${item.name}, ${item.city}`,
                    latitude: item.lat,
                    longitude: item.lng,
                  })
                }
              >
                <View style={styles.resultIconBg}>
                  <Ionicons
                    name={
                      item.icon === 'airplane'
                        ? 'airplane'
                        : item.icon === 'subway'
                        ? 'subway'
                        : item.icon === 'restaurant'
                        ? 'restaurant'
                        : 'business'
                    }
                    size={16}
                    color="#475569"
                  />
                </View>
                <View style={styles.resultTextCol}>
                  <Text style={styles.resultName}>{item.name}</Text>
                  <Text style={styles.resultAddress}>{item.city}</Text>
                </View>
              </TouchableOpacity>
            )}
          />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create<any>({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  backBtn: {
    padding: 6,
    borderRadius: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  closeTextBtn: {
    padding: 6,
  },
  closeText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#10b981',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  connectorCol: {
    alignItems: 'center',
    marginRight: 12,
    paddingVertical: 6,
  },
  dotCircle: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10b981',
  },
  activeDotCircle: {
    transform: [{ scale: 1.3 }],
    borderWidth: 2,
    borderColor: '#059669',
  },
  connectorLine: {
    width: 2,
    height: 28,
    backgroundColor: '#cbd5e1',
    marginVertical: 4,
  },
  squareBox: {
    width: 10,
    height: 10,
    borderRadius: 2,
    backgroundColor: '#000000',
  },
  activeSquareBox: {
    transform: [{ scale: 1.3 }],
    borderWidth: 2,
    borderColor: '#475569',
  },
  fieldsCol: {
    flex: 1,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    paddingHorizontal: 12,
    height: 44,
  },
  activeInputBox: {
    borderColor: '#2563EB',
    backgroundColor: '#ffffff',
    borderWidth: 2,
    boxShadow: '0 0 0 3px rgba(37, 99, 235, 0.12)',
  },
  textInput: {
    flex: 1,
    height: '100%',
    fontSize: 14,
    color: '#0f172a',
    fontWeight: '600',
    padding: 0,
    outlineStyle: 'none' as any,
    borderWidth: 0,
  },
  addressDisplay: {
    flex: 1,
    fontSize: 14,
    color: '#0f172a',
    fontWeight: '600',
  },
  placeholderText: {
    color: '#94a3b8',
    fontWeight: '400',
  },
  clearBtn: {
    padding: 4,
  },
  fieldSpacer: {
    height: 8,
  },
  swapBtn: {
    padding: 8,
    marginLeft: 10,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
    height: 42,
    width: 42,
  },
  gpsActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    backgroundColor: '#ffffff',
  },
  gpsIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  gpsTextCol: {
    flex: 1,
  },
  gpsActionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  gpsActionSub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 1,
  },
  mapHintBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f1f5f9',
  },
  mapHintText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
  },
  listContainer: {
    flex: 1,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 0.6,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
  },
  resultIconBg: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  resultTextCol: {
    flex: 1,
  },
  resultName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  resultAddress: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
    lineHeight: 16,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 30,
  },
  loadingText: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },
  emptySubText: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 4,
  },
});
