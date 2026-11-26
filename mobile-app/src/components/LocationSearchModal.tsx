import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../services/api';
import { PlaceSuggestion } from '../types';

interface LocationSearchModalProps {
  visible: boolean;
  title: string;
  onClose: () => void;
  onSelect: (location: { address: string; latitude: number; longitude: number }) => void;
}

export const LocationSearchModal: React.FC<LocationSearchModalProps> = ({
  visible,
  title,
  onClose,
  onSelect,
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlaceSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [detectingGps, setDetectingGps] = useState(false);

  useEffect(() => {
    if (query.trim().length >= 3) {
      const delay = setTimeout(async () => {
        setLoading(true);
        try {
          const resp = await api.location.searchPlaces(query.trim(), 8);
          setResults(resp.suggestions);
        } catch (e) {
          console.error('Search error:', e);
        } finally {
          setLoading(false);
        }
      }, 350);

      return () => clearTimeout(delay);
    } else {
      setResults([]);
    }
  }, [query]);

  const handleUseCurrentLocation = async () => {
    setDetectingGps(true);
    try {
      if (Platform.OS === 'web' && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            const { latitude, longitude } = pos.coords;
            try {
              const geo = await api.location.reverseGeocode(latitude, longitude);
              onSelect({
                address: geo.address,
                latitude,
                longitude,
              });
              onClose();
            } catch (err) {
              onSelect({
                address: `GPS Location (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`,
                latitude,
                longitude,
              });
              onClose();
            } finally {
              setDetectingGps(false);
            }
          },
          (err) => {
            alert('Could not access device GPS. Defaulting to Bangalore.');
            onSelect({
              address: 'Indiranagar 100 Feet Road, Bengaluru, Karnataka',
              latitude: 12.9716,
              longitude: 77.6412,
            });
            setDetectingGps(false);
            onClose();
          },
          { enableHighAccuracy: true, timeout: 8000 }
        );
      } else {
        // Fallback default
        onSelect({
          address: 'Indiranagar 100 Feet Road, Bengaluru, Karnataka',
          latitude: 12.9716,
          longitude: 77.6412,
        });
        setDetectingGps(false);
        onClose();
      }
    } catch (e) {
      setDetectingGps(false);
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent={true} onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={24} color="#111827" />
            </TouchableOpacity>
          <Text style={styles.headerTitle}>{title}</Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Search Input */}
        <View style={styles.inputContainer}>
          <Ionicons name="search" size={20} color="#6b7280" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search landmark, street or area in India..."
            placeholderTextColor="#9ca3af"
            value={query}
            onChangeText={setQuery}
            autoFocus
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')}>
              <Ionicons name="close-circle" size={18} color="#9ca3af" />
            </TouchableOpacity>
          )}
        </View>

        {/* GPS Live Button */}
        <TouchableOpacity
          style={styles.gpsRow}
          onPress={handleUseCurrentLocation}
          disabled={detectingGps}
        >
          <View style={styles.gpsIconBg}>
            {detectingGps ? (
              <ActivityIndicator size="small" color="#10b981" />
            ) : (
              <Ionicons name="navigate" size={18} color="#10b981" />
            )}
          </View>
          <View style={styles.gpsTextContainer}>
            <Text style={styles.gpsTitle}>Use Current GPS Location</Text>
            <Text style={styles.gpsSubtitle}>Auto-detect using device location</Text>
          </View>
        </TouchableOpacity>

        {/* Results List */}
        {loading ? (
          <View style={styles.loaderCenter}>
            <ActivityIndicator size="large" color="#10b981" />
            <Text style={styles.loaderText}>Searching places in India...</Text>
          </View>
        ) : (
          <FlatList
            data={results}
            keyExtractor={(item) => item.place_id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.resultItem}
                onPress={() => {
                  onSelect({
                    address: item.formatted_address,
                    latitude: item.latitude,
                    longitude: item.longitude,
                  });
                  onClose();
                }}
              >
                <Ionicons name="location-outline" size={22} color="#4b5563" style={styles.pinIcon} />
                <View style={styles.resultTextCol}>
                  <Text style={styles.placeName}>{item.name}</Text>
                  <Text style={styles.placeAddress} numberOfLines={2}>
                    {item.formatted_address}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              query.length >= 3 ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No matching locations found in India.</Text>
                </View>
              ) : (
                <View style={styles.popularContainer}>
                  <Text style={styles.popularHeader}>POPULAR INDIAN LANDMARKS</Text>
                  {[
                    { name: 'Indiranagar 100 Feet Rd', addr: 'Bengaluru, Karnataka', lat: 12.9716, lng: 77.6412 },
                    { name: 'Koramangala 5th Block', addr: 'Bengaluru, Karnataka', lat: 12.9352, lng: 77.6245 },
                    { name: 'Connaught Place (CP)', addr: 'New Delhi, Delhi', lat: 28.6315, lng: 77.2167 },
                    { name: 'Cyber Hub Gurgaon', addr: 'Gurugram, Haryana', lat: 28.4952, lng: 77.0886 },
                    { name: 'Bandra Kurla Complex (BKC)', addr: 'Mumbai, Maharashtra', lat: 19.0662, lng: 72.8682 },
                  ].map((preset, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={styles.resultItem}
                      onPress={() => {
                        onSelect({
                          address: `${preset.name}, ${preset.addr}`,
                          latitude: preset.lat,
                          longitude: preset.lng,
                        });
                        onClose();
                      }}
                    >
                      <Ionicons name="business-outline" size={20} color="#10b981" style={styles.pinIcon} />
                      <View style={styles.resultTextCol}>
                        <Text style={styles.placeName}>{preset.name}</Text>
                        <Text style={styles.placeAddress}>{preset.addr}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )
            }
          />
        )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create<any>({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  modalContainer: {
    width: Platform.OS === 'web' ? 440 : '100%',
    height: '100%',
    backgroundColor: '#ffffff',
    paddingTop: Platform.OS === 'ios' ? 44 : 20,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 12,
    height: 48,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    fontSize: 15,
    color: '#111827',
    outlineStyle: 'none' as any,
    borderWidth: 0,
    backgroundColor: 'transparent',
  },
  gpsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  gpsIconBg: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  gpsTextContainer: {
    flex: 1,
  },
  gpsTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#10b981',
  },
  gpsSubtitle: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f9fafb',
  },
  pinIcon: {
    marginRight: 14,
  },
  resultTextCol: {
    flex: 1,
  },
  placeName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
  },
  placeAddress: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  loaderCenter: {
    marginTop: 40,
    alignItems: 'center',
  },
  loaderText: {
    marginTop: 10,
    fontSize: 14,
    color: '#6b7280',
  },
  emptyContainer: {
    marginTop: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#9ca3af',
  },
  popularContainer: {
    paddingTop: 12,
  },
  popularHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9ca3af',
    letterSpacing: 1,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
});
