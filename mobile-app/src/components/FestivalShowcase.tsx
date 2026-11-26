import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  Dimensions,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

interface FestivalShowcaseProps {
  onToggleMapPreview?: () => void;
  selectedCategory?: string;
  onSelectCategory?: (category: any) => void;
  pickupAddress?: string;
  destinationAddress?: string;
}

const FESTIVE_SLIDES = [
  {
    id: 1,
    tag: 'MEGA FESTIVE DHAMAKA',
    tagColor: '#f59e0b',
    title: '50% OFF Festive Rides 🪔',
    subtitle: 'Celebrate the festive season with lowest fares! Save up to ₹75 on your first 3 Bike & Auto rides.',
    promoCode: 'FESTIVE50',
    icon: 'sparkles',
    accentColor: '#d97706',
    bgGradient: '#1e1b4b',
    badgeText: 'Flat 50% Discount',
  },
  {
    id: 2,
    tag: 'FESTIVE RUSH EXPRESS',
    tagColor: '#10b981',
    title: 'Beat Festival Traffic in 3 Mins ⚡',
    subtitle: 'Lightning fast Bike Taxis starting at just ₹7/km. Guaranteed pickup in under 3 minutes across India.',
    promoCode: 'FESTIVEMOTO',
    icon: 'bicycle',
    accentColor: '#059669',
    bgGradient: '#064e3b',
    badgeText: '₹7/km Lowest Fare',
  },
  {
    id: 3,
    tag: 'ZERO SURGE PASS',
    tagColor: '#3b82f6',
    title: 'Zero Surge During Puja & Rush 🎟️',
    subtitle: 'No 2x/3x price hikes during evening temple visits, markets, and pandal hopping all week.',
    promoCode: 'ZEROSURGE',
    icon: 'shield-checkmark',
    accentColor: '#2563eb',
    bgGradient: '#1e3a8a',
    badgeText: '100% Surge Free',
  },
  {
    id: 4,
    tag: 'ECO FESTIVE AUTO',
    tagColor: '#14b8a6',
    title: 'Festive Auto @ Flat ₹29 🛺',
    subtitle: 'Affordable, metered CNG & Electric Auto rides for family outings and festival shopping.',
    promoCode: 'AUTOFEST',
    icon: 'car-sport',
    accentColor: '#0d9488',
    bgGradient: '#134e4a',
    badgeText: 'Flat ₹29 Base',
  },
  {
    id: 5,
    tag: 'LUCKY DRAW & CASHBACK',
    tagColor: '#ec4899',
    title: 'Win Pure Gold Coins & ₹500 Cashback 🎁',
    subtitle: 'Complete 3 festive rides this week and stand a chance to win guaranteed cashback & festive rewards.',
    promoCode: 'LUCKYGOLD',
    icon: 'gift',
    accentColor: '#db2777',
    bgGradient: '#831843',
    badgeText: 'Mega Lucky Draw',
  },
];

const RUNNING_TICKER_ITEMS = [
  '🎉 18,650+ Festive Rides Completed Today Across India!',
  '🪔 Use Code "FESTIVE50" for Instant 50% Off',
  '⚡ 480+ Drivers Online in Bangalore, Delhi & Mumbai',
  '🛡️ Free ₹10 Lakh Festive Passenger Insurance',
  '🏍️ Bike Taxis starting @ ₹7/km • Auto Flat ₹29',
  '🛺 Zero Surge Guarantee During Festival Rush Hours',
];

export const FestivalShowcase: React.FC<FestivalShowcaseProps> = ({
  onToggleMapPreview,
  pickupAddress,
  destinationAddress,
}) => {
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [appliedCode, setAppliedCode] = useState<string | null>(null);
  const [tickerOffset, setTickerOffset] = useState(0);

  // Auto-slide running carousel every 4 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlideIndex((prev) => (prev + 1) % FESTIVE_SLIDES.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  // Running ticker marquee loop
  useEffect(() => {
    const tickerTimer = setInterval(() => {
      setTickerOffset((prev) => (prev + 1) % RUNNING_TICKER_ITEMS.length);
    }, 3000);
    return () => clearInterval(tickerTimer);
  }, []);

  const activeSlide = FESTIVE_SLIDES[currentSlideIndex];

  const handleApplyCode = (code: string) => {
    setAppliedCode(code);
  };

  return (
    <View style={styles.container}>
      {/* Top Banner Navigation Bar */}
      <View style={styles.topControlBar}>
        <View style={styles.festiveTag}>
          <Text style={styles.diyaIcon}>🪔</Text>
          <Text style={styles.festiveTagText}>GREAT INDIAN RIDE FESTIVAL</Text>
          <View style={styles.livePill}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
        </View>

        {onToggleMapPreview && (
          <TouchableOpacity
            style={styles.mapPreviewBtn}
            onPress={onToggleMapPreview}
            activeOpacity={0.8}
          >
            <Ionicons name="map" size={15} color="#0f172a" />
            <Text style={styles.mapPreviewBtnText}>Preview Map</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Running Marquee Ticker ("Running Festival") */}
      <View style={styles.tickerBar}>
        <View style={styles.tickerBadge}>
          <Ionicons name="flash" size={14} color="#f59e0b" />
          <Text style={styles.tickerBadgeText}>RUSH UPDATES</Text>
        </View>
        <Text style={styles.tickerText} numberOfLines={1}>
          {RUNNING_TICKER_ITEMS[tickerOffset]}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Running Festival Carousel Card */}
        <View style={[styles.heroCard, { backgroundColor: activeSlide.bgGradient }]}>
          <View style={styles.cardHeaderRow}>
            <View style={[styles.cardTagBadge, { backgroundColor: activeSlide.tagColor }]}>
              <Text style={styles.cardTagText}>{activeSlide.tag}</Text>
            </View>
            <View style={styles.discountPill}>
              <Text style={styles.discountPillText}>{activeSlide.badgeText}</Text>
            </View>
          </View>

          <Text style={styles.heroTitle}>{activeSlide.title}</Text>
          <Text style={styles.heroSubtitle}>{activeSlide.subtitle}</Text>

          {/* Promo Code & Action Box */}
          <View style={styles.promoActionRow}>
            <View style={styles.promoCodeBox}>
              <Text style={styles.promoLabel}>USE PROMO CODE</Text>
              <Text style={styles.promoCodeText}>{activeSlide.promoCode}</Text>
            </View>

            <TouchableOpacity
              style={[
                styles.applyBtn,
                appliedCode === activeSlide.promoCode && styles.appliedBtn,
              ]}
              onPress={() => handleApplyCode(activeSlide.promoCode)}
              activeOpacity={0.85}
            >
              <Ionicons
                name={appliedCode === activeSlide.promoCode ? 'checkmark-circle' : 'gift-outline'}
                size={16}
                color="#ffffff"
              />
              <Text style={styles.applyBtnText}>
                {appliedCode === activeSlide.promoCode ? 'APPLIED (₹25 OFF)' : 'APPLY CODE'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Carousel Slide Indicators */}
          <View style={styles.indicatorsRow}>
            {FESTIVE_SLIDES.map((slide, idx) => (
              <TouchableOpacity
                key={slide.id}
                style={[
                  styles.dot,
                  idx === currentSlideIndex && styles.activeDot,
                ]}
                onPress={() => setCurrentSlideIndex(idx)}
              />
            ))}
          </View>
        </View>

        {/* Applied Coupon Toast Banner */}
        {appliedCode && (
          <View style={styles.appliedSuccessBanner}>
            <Ionicons name="sparkles" size={18} color="#10b981" />
            <Text style={styles.appliedSuccessText}>
              🎉 Festive Promo <Text style={{ fontWeight: '900' }}>{appliedCode}</Text> applied! You save up to ₹50 on this booking.
            </Text>
          </View>
        )}

        {/* Live Festival Hubs & Active Drivers Heatmap */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.iconCircle}>
              <Ionicons name="speedometer" size={18} color="#2563eb" />
            </View>
            <View>
              <Text style={styles.sectionTitle}>Festival City Rush & Availability</Text>
              <Text style={styles.sectionSub}>Real-time driver supply during evening festival rush</Text>
            </View>
          </View>

          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Text style={styles.statCity}>Bengaluru</Text>
              <Text style={styles.statCount}>192 Drivers</Text>
              <Text style={styles.statEta}>⚡ Avg ETA: 2 mins</Text>
            </View>

            <View style={styles.statBox}>
              <Text style={styles.statCity}>Delhi NCR</Text>
              <Text style={styles.statCount}>245 Drivers</Text>
              <Text style={styles.statEta}>⚡ Avg ETA: 3 mins</Text>
            </View>

            <View style={styles.statBox}>
              <Text style={styles.statCity}>Mumbai</Text>
              <Text style={styles.statCount}>188 Drivers</Text>
              <Text style={styles.statEta}>⚡ Avg ETA: 2 mins</Text>
            </View>

            <View style={styles.statBox}>
              <Text style={styles.statCity}>Hyderabad</Text>
              <Text style={styles.statCount}>142 Drivers</Text>
              <Text style={styles.statEta}>⚡ Avg ETA: 3 mins</Text>
            </View>
          </View>
        </View>

        {/* Festive Deals Grid */}
        <Text style={styles.gridSectionHeading}>ALL FESTIVAL PERKS & SAVINGS</Text>
        <View style={styles.dealsRow}>
          <View style={styles.dealMiniCard}>
            <View style={[styles.miniIconBg, { backgroundColor: '#fef3c7' }]}>
              <Text style={{ fontSize: 20 }}>🏍️</Text>
            </View>
            <Text style={styles.dealTitle}>Camp Bike Rush</Text>
            <Text style={styles.dealRate}>₹7 / km</Text>
            <Text style={styles.dealDesc}>Fastest way through temple and festival market jams.</Text>
          </View>

          <View style={styles.dealMiniCard}>
            <View style={[styles.miniIconBg, { backgroundColor: '#ccfbf1' }]}>
              <Text style={{ fontSize: 20 }}>🛺</Text>
            </View>
            <Text style={styles.dealTitle}>Festive Auto</Text>
            <Text style={styles.dealRate}>Flat ₹29</Text>
            <Text style={styles.dealDesc}>Comfortable, safe, metered family travel across the city.</Text>
          </View>

          <View style={styles.dealMiniCard}>
            <View style={[styles.miniIconBg, { backgroundColor: '#e0e7ff' }]}>
              <Text style={{ fontSize: 20 }}>🚗</Text>
            </View>
            <Text style={styles.dealTitle}>Camp Cab AC</Text>
            <Text style={styles.dealRate}>₹15 / km</Text>
            <Text style={styles.dealDesc}>AC compact hatchback for evening shopping & sweets pickup.</Text>
          </View>
        </View>

        {/* Safety & Trust Festive Pillars */}
        <View style={styles.safetyCard}>
          <View style={styles.safetyHeader}>
            <Ionicons name="shield-checkmark" size={20} color="#10b981" />
            <Text style={styles.safetyTitle}>Festive Safety & Peace of Mind</Text>
          </View>
          <View style={styles.safetyBullets}>
            <Text style={styles.safetyBulletItem}>
              ✓ <Text style={{ fontWeight: '700' }}>4-Digit Pickup PIN:</Text> Never enter the wrong vehicle; ride only starts when driver verifies PIN.
            </Text>
            <Text style={styles.safetyBulletItem}>
              ✓ <Text style={{ fontWeight: '700' }}>Live GPS Radar Tracking:</Text> Map automatically launches the moment you book!
            </Text>
            <Text style={styles.safetyBulletItem}>
              ✓ <Text style={{ fontWeight: '700' }}>Free ₹10 Lakh Insurance:</Text> Complete accidental coverage on every completed ride.
            </Text>
          </View>
        </View>

        {/* How It Works Guide */}
        <View style={styles.howItWorksCard}>
          <Text style={styles.howTitle}>🚀 HOW IT WORKS</Text>
          <View style={styles.stepRow}>
            <View style={styles.stepBadge}>
              <Text style={styles.stepNum}>1</Text>
            </View>
            <Text style={styles.stepText}>Choose pickup & destination in the side panel</Text>
          </View>

          <View style={styles.stepRow}>
            <View style={styles.stepBadge}>
              <Text style={styles.stepNum}>2</Text>
            </View>
            <Text style={styles.stepText}>Select Bike (₹7/km), Auto or Car and tap "Request"</Text>
          </View>

          <View style={styles.stepRow}>
            <View style={styles.stepBadge}>
              <Text style={styles.stepNum}>3</Text>
            </View>
            <Text style={styles.stepText}>Live moving radar automatically launches to find nearest driver</Text>
          </View>

          <View style={styles.stepRow}>
            <View style={styles.stepBadge}>
              <Text style={styles.stepNum}>4</Text>
            </View>
            <Text style={styles.stepText}>When driver accepts, track them live on the map and share your PIN!</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0f19',
  },
  topControlBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    backgroundColor: '#0f172a',
  },
  festiveTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  diyaIcon: {
    fontSize: 20,
  },
  festiveTagText: {
    color: '#fbbf24',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#064e3b',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#10b981',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
  },
  liveText: {
    color: '#10b981',
    fontSize: 10,
    fontWeight: '900',
  },
  mapPreviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  mapPreviewBtnText: {
    color: '#0f172a',
    fontSize: 12,
    fontWeight: '800',
  },
  tickerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e1b4b',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#312e81',
  },
  tickerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#4338ca',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginRight: 10,
  },
  tickerBadgeText: {
    color: '#fbbf24',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  tickerText: {
    color: '#e2e8f0',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 60,
  },
  heroCard: {
    borderRadius: 20,
    padding: 24,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  cardTagBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  cardTagText: {
    color: '#000000',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  discountPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  discountPillText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: '#ffffff',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    fontSize: 14,
    color: '#cbd5e1',
    lineHeight: 20,
    marginBottom: 20,
  },
  promoActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
  },
  promoCodeBox: {
    flex: 1,
  },
  promoLabel: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  promoCodeText: {
    color: '#fbbf24',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1,
    marginTop: 2,
  },
  applyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#10b981',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  appliedBtn: {
    backgroundColor: '#059669',
  },
  applyBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '900',
  },
  indicatorsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  activeDot: {
    width: 24,
    backgroundColor: '#ffffff',
  },
  appliedSuccessBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#064e3b',
    borderWidth: 1,
    borderColor: '#10b981',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  appliedSuccessText: {
    color: '#ecfdf5',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  sectionCard: {
    backgroundColor: '#111827',
    borderRadius: 18,
    padding: 18,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1e3a8a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  sectionSub: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 2,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statBox: {
    flex: 1,
    minWidth: 130,
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#374151',
  },
  statCity: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '700',
  },
  statCount: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900',
    marginTop: 2,
  },
  statEta: {
    color: '#10b981',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
  },
  gridSectionHeading: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  dealsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 18,
  },
  dealMiniCard: {
    flex: 1,
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  miniIconBg: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  dealTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  dealRate: {
    color: '#10b981',
    fontSize: 16,
    fontWeight: '900',
    marginTop: 4,
  },
  dealDesc: {
    color: '#94a3b8',
    fontSize: 11,
    lineHeight: 15,
    marginTop: 6,
  },
  safetyCard: {
    backgroundColor: '#0f172a',
    borderRadius: 16,
    padding: 16,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  safetyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  safetyTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  safetyBullets: {
    gap: 6,
  },
  safetyBulletItem: {
    color: '#cbd5e1',
    fontSize: 12,
    lineHeight: 18,
  },
  howItWorksCard: {
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  howTitle: {
    color: '#f59e0b',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  stepBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNum: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '900',
  },
  stepText: {
    color: '#e2e8f0',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
});
