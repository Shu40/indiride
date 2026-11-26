import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { VehicleCategory } from '../types';

interface ForYouGridProps {
  onSelectCategory?: (category: VehicleCategory) => void;
  onOpenTransit?: () => void;
  onOpenPasses?: () => void;
  onOpenCampusRides?: () => void;
  selectedCategory?: VehicleCategory;
}

export const ForYouGrid: React.FC<ForYouGridProps> = ({
  onSelectCategory,
  onOpenTransit,
  onOpenPasses,
  onOpenCampusRides,
  selectedCategory,
}) => {
  const serviceCards = [
    {
      id: 'campus_ride',
      title: 'Campus Ride',
      badge: 'Student',
      badgeColor: '#0284c7',
      subtitle: 'Verified Carpool',
      image: require('../../assets/vehicles/campus.png'),
      bgTint: '#e0f2fe',
      isCampus: true,
    },
    {
      id: 'bike',
      title: 'Bike',
      badge: 'Fastest',
      badgeColor: '#10b981',
      subtitle: 'Fastest Moto Taxi',
      image: require('../../assets/vehicles/bike.png'),
      bgTint: '#dcfce7',
      category: 'bike' as VehicleCategory,
    },
    {
      id: 'auto',
      title: 'Auto',
      badge: 'Popular',
      badgeColor: '#f59e0b',
      subtitle: 'Doorstep Pickup',
      image: require('../../assets/vehicles/auto.png'),
      bgTint: '#fef3c7',
      category: 'auto' as VehicleCategory,
    },
    {
      id: 'car',
      title: 'Cars',
      badge: 'Comfort',
      badgeColor: '#3b82f6',
      subtitle: 'Go & Sedan',
      image: require('../../assets/vehicles/car.png'),
      bgTint: '#e0e7ff',
      category: 'car' as VehicleCategory,
    },
    {
      id: 'teen',
      title: 'Teen',
      badge: 'Safety PIN',
      badgeColor: '#8b5cf6',
      subtitle: 'Safe Rides for Teens',
      image: require('../../assets/vehicles/teen.png'),
      bgTint: '#f3e8ff',
      category: 'car' as VehicleCategory,
    },
    {
      id: 'bus_train',
      title: 'Bus & Train',
      badge: 'Transit',
      badgeColor: '#059669',
      subtitle: 'Metro & City Bus',
      image: require('../../assets/vehicles/transit.png'),
      bgTint: '#d1fae5',
      isTransit: true,
    },
    {
      id: 'save_everyday',
      title: 'Save Every Day',
      badge: 'Daily Pass',
      badgeColor: '#dc2626',
      subtitle: 'Commuter Savings',
      image: require('../../assets/vehicles/pass.png'),
      bgTint: '#fee2e2',
      isPass: true,
    },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>Suggestions / For you</Text>
        <Text style={styles.sectionSubtitle}>Tap to book instant city ride</Text>
      </View>

      <View style={styles.grid}>
        {serviceCards.map((item) => {
          const isSelected = selectedCategory === item.category && !item.isTransit && !item.isPass;
          return (
            <TouchableOpacity
              key={item.id}
              style={[
                styles.card,
                isSelected && styles.cardSelected,
              ]}
              onPress={() => {
                if (item.isCampus && onOpenCampusRides) {
                  onOpenCampusRides();
                } else if (item.isTransit && onOpenTransit) {
                  onOpenTransit();
                } else if (item.isPass && onOpenPasses) {
                  onOpenPasses();
                } else if (onSelectCategory && item.category) {
                  onSelectCategory(item.category);
                }
              }}
              activeOpacity={0.82}
            >
              {/* Top Row: Colorful Vehicle Graphic & Promo Badge */}
              <View style={styles.cardTop}>
                <View
                  style={[
                    styles.vehicleImgWrapper,
                    { backgroundColor: item.bgTint },
                    isSelected && styles.vehicleImgWrapperSelected,
                  ]}
                >
                  <Image
                    source={item.image}
                    style={styles.vehicleImage}
                    resizeMode="contain"
                  />
                </View>

                <View
                  style={[
                    styles.badgePill,
                    { backgroundColor: `${item.badgeColor}18`, borderColor: `${item.badgeColor}40` },
                  ]}
                >
                  <Text style={[styles.badgeText, { color: item.badgeColor }]}>
                    {item.badge}
                  </Text>
                </View>
              </View>

              {/* Title and Subtitle */}
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardSubtitle} numberOfLines={1}>
                {item.subtitle}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 12,
    marginVertical: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  sectionSubtitle: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '500',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'space-between',
  },
  card: {
    width: '31.5%',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 9,
    borderWidth: 1.2,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardSelected: {
    borderColor: '#0f172a',
    backgroundColor: '#f8fafc',
    borderWidth: 2,
    shadowOpacity: 0.12,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  vehicleImgWrapper: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 3,
  },
  vehicleImgWrapperSelected: {
    borderWidth: 1.5,
    borderColor: '#0f172a',
  },
  vehicleImage: {
    width: 32,
    height: 32,
  },
  badgePill: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 0.5,
  },
  badgeText: {
    fontSize: 8,
    fontWeight: '800',
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 2,
  },
  cardSubtitle: {
    fontSize: 9,
    color: '#64748b',
    marginTop: 1,
  },
});
