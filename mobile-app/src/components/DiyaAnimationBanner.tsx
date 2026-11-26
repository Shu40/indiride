import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
  ScrollView,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../services/api';
import { FestivalCampaign } from '../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface DiyaAnimationBannerProps {
  onApplyPromo?: (code: string) => void;
  onSelectCampusRide?: () => void;
}

interface PromoAdCard {
  id: string;
  category: 'diwali' | 'chhath' | 'campus' | 'general';
  festivalTag: string;
  discountText: string;
  headline: string;
  subtitle: string;
  promoCode: string;
  themeColor: string;
  badgeBg: string;
  cardBg: string;
  borderColor: string;
  isSelfRide?: boolean;
}

export const DiyaAnimationBanner: React.FC<DiyaAnimationBannerProps> = ({
  onApplyPromo,
  onSelectCampusRide,
}) => {
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  // Dynamic campaign data loaded from backend
  const [backendCampaign, setBackendCampaign] = useState<FestivalCampaign | null>(null);

  // Animated flame values for authentic flickering diya effect
  const flameScale = useRef(new Animated.Value(1)).current;
  const flameOpacity = useRef(new Animated.Value(0.9)).current;
  const flameTranslateY = useRef(new Animated.Value(0)).current;
  const glowPulse = useRef(new Animated.Value(1)).current;

  // Animated pulse for Chhath Puja glowing sun
  const sunPulse = useRef(new Animated.Value(1)).current;

  // Animated pulse for Campus Self Ride badge
  const campusBadgePulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let isMounted = true;
    async function loadCampaign() {
      try {
        const res: any = await api.festival.getPublic();
        if (isMounted && res) {
          const c = res.campaign || res;
          if (c && c.is_active === true) {
            setBackendCampaign(c);
          } else {
            setBackendCampaign(null);
          }
        }
      } catch (err) {
        if (isMounted) setBackendCampaign(null);
      }
    }
    loadCampaign();

    const useNativeDriver = Platform.OS !== 'web';

    // 1. Diya Flame Flickering Animation Loop
    const diyaLoop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(flameScale, {
            toValue: 1.18,
            duration: 350,
            useNativeDriver,
          }),
          Animated.timing(flameOpacity, {
            toValue: 1,
            duration: 350,
            useNativeDriver,
          }),
          Animated.timing(flameTranslateY, {
            toValue: -2,
            duration: 350,
            useNativeDriver,
          }),
          Animated.timing(glowPulse, {
            toValue: 1.15,
            duration: 350,
            useNativeDriver,
          }),
        ]),
        Animated.parallel([
          Animated.timing(flameScale, {
            toValue: 0.92,
            duration: 400,
            useNativeDriver,
          }),
          Animated.timing(flameOpacity, {
            toValue: 0.75,
            duration: 400,
            useNativeDriver,
          }),
          Animated.timing(flameTranslateY, {
            toValue: 1,
            duration: 400,
            useNativeDriver,
          }),
          Animated.timing(glowPulse, {
            toValue: 0.95,
            duration: 400,
            useNativeDriver,
          }),
        ]),
        Animated.parallel([
          Animated.timing(flameScale, {
            toValue: 1.05,
            duration: 300,
            useNativeDriver,
          }),
          Animated.timing(flameOpacity, {
            toValue: 0.95,
            duration: 300,
            useNativeDriver,
          }),
          Animated.timing(flameTranslateY, {
            toValue: -1,
            duration: 300,
            useNativeDriver,
          }),
          Animated.timing(glowPulse, {
            toValue: 1.05,
            duration: 300,
            useNativeDriver,
          }),
        ]),
      ])
    );
    diyaLoop.start();

    // 2. Chhath Puja Sun Pulsing Glow Animation
    const sunLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(sunPulse, {
          toValue: 1.12,
          duration: 900,
          useNativeDriver,
        }),
        Animated.timing(sunPulse, {
          toValue: 1.0,
          duration: 900,
          useNativeDriver,
        }),
      ])
    );
    sunLoop.start();

    // 3. Campus Self Ride Badge subtle breathe animation
    const campusLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(campusBadgePulse, {
          toValue: 1.08,
          duration: 1000,
          useNativeDriver,
        }),
        Animated.timing(campusBadgePulse, {
          toValue: 1.0,
          duration: 1000,
          useNativeDriver,
        }),
      ])
    );
    campusLoop.start();

    return () => {
      isMounted = false;
      diyaLoop.stop();
      sunLoop.stop();
      campusLoop.stop();
    };
  }, []);

  // 3 Dynamic Ad Boxes as requested:
  // 1. Diwali Offer (5% ride discount, same flickering diya)
  // 2. Chhath Puja (10% ride discount)
  const adCards: PromoAdCard[] = [];

  // 1. Dynamic Active Festival Card (Only when active and within valid date window)
  if (backendCampaign && backendCampaign.is_active === true) {
    const festName = (backendCampaign.festival_name || 'Festive Offer').trim();
    const festLower = festName.toLowerCase();
    const isDiwali = festLower.includes('diwali');
    const isChhath = festLower.includes('chhath');
    const festEmoji = isDiwali ? '🪔' : isChhath ? '🌅' : '🎉';
    const cat = isDiwali ? 'diwali' : isChhath ? 'chhath' : 'general';

    adCards.push({
      id: 'ad-festival-live',
      category: cat as any,
      festivalTag: `${festEmoji} ${festName.toUpperCase()} SPECIAL`,
      discountText: `FLAT ${backendCampaign.discount_percent || 10}% OFF`,
      headline: backendCampaign.banner_title || `${festEmoji} ${festName} Offer`,
      subtitle:
        backendCampaign.banner_subtitle ||
        backendCampaign.tagline ||
        'Special festive celebration discount on all rides!',
      promoCode: backendCampaign.promo_code || 'FESTIVE10',
      themeColor: backendCampaign.theme_color || (isDiwali ? '#d97706' : isChhath ? '#ea580c' : '#0284c7'),
      badgeBg: '#10b981',
      cardBg: isDiwali ? '#fffbeb' : isChhath ? '#fff7ed' : '#f0fdf4',
      borderColor: isDiwali ? '#fde68a' : isChhath ? '#fed7aa' : '#bbf7d0',
    });
  }

  // 2. Campus Ride (Student / Peer carpool savings)
  adCards.push({
    id: 'ad-campus',
    category: 'campus',
    festivalTag: '🎓 CAMPUS RIDE',
    discountText: 'FLAT 20% OFF',
    headline: '🎓 Campus & Student Travel',
    subtitle: 'Affordable peer carpool & campus transit • Self Ride with peers',
    promoCode: 'CAMPUS20',
    themeColor: '#2563eb',
    badgeBg: '#2563eb',
    cardBg: '#eff6ff',
    borderColor: '#bfdbfe',
    isSelfRide: true,
  });

  // 3. Daily Commute Pass
  adCards.push({
    id: 'ad-pass',
    category: 'general' as any,
    festivalTag: '⚡ COMMUTER PASS',
    discountText: 'SAVE UP TO 30%',
    headline: '⚡ Daily City Commute Savings',
    subtitle: 'Pocket-friendly rides with zero surge for daily office goers',
    promoCode: 'DAILYPASS',
    themeColor: '#059669',
    badgeBg: '#059669',
    cardBg: '#ecfdf5',
    borderColor: '#a7f3d0',
  });

  const handleApplyPromoCode = (code: string) => {
    setCopiedCode(code);
    if (onApplyPromo) {
      onApplyPromo(code);
    }
    setTimeout(() => {
      setCopiedCode((curr) => (curr === code ? null : curr));
    }, 2500);
  };

  const cardWidth = Math.min(SCREEN_WIDTH - 60, 330);

  // Auto-scroll through the 3 offer cards continuously every 3.8s
  const cardIndexRef = useRef(0);
  cardIndexRef.current = activeCardIndex;

  useEffect(() => {
    const cardStep = cardWidth + 12;
    const timer = setInterval(() => {
      const nextIdx = (cardIndexRef.current + 1) % adCards.length;
      scrollRef.current?.scrollTo({ x: nextIdx * cardStep, animated: true });
      setActiveCardIndex(nextIdx);
    }, 3800);

    return () => clearInterval(timer);
  }, [adCards.length, cardWidth]);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const cardStep = cardWidth + 12;
    const index = Math.round(offsetX / cardStep);
    if (index >= 0 && index < adCards.length && index !== activeCardIndex) {
      setActiveCardIndex(index);
    }
  };

  const scrollToCard = (index: number) => {
    const cardStep = cardWidth + 12;
    scrollRef.current?.scrollTo({ x: index * cardStep, animated: true });
    setActiveCardIndex(index);
  };

  return (
    <View style={styles.outerContainer}>
      {/* Header Bar with More Than One Ads Indicator */}
      <View style={styles.topMetaBar}>
        <View style={styles.metaTitleRow}>
          <Ionicons name="sparkles" size={13} color="#d97706" />
          <Text style={styles.metaTitle}>SPECIAL OFFERS & PROMOS</Text>
          <View style={styles.counterBadge}>
            <Text style={styles.counterText}>{adCards.length} OFFERS</Text>
          </View>
        </View>

        {/* Interactive Indicator Dots */}
        <View style={styles.dotContainer}>
          {adCards.map((card, i) => (
            <TouchableOpacity
              key={card.id}
              onPress={() => scrollToCard(i)}
              style={[
                styles.dot,
                activeCardIndex === i && {
                  backgroundColor: card.themeColor,
                  width: 16,
                },
              ]}
              hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
            />
          ))}
        </View>
      </View>

      {/* Horizontal Multi-Box Cards Container */}
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        snapToInterval={cardWidth + 12}
        decelerationRate="fast"
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {adCards.map((card, index) => {
          const isCopied = copiedCode === card.promoCode;

          return (
            <View
              key={card.id}
              style={[
                styles.cardBox,
                {
                  width: cardWidth,
                  backgroundColor: card.cardBg,
                  borderColor: card.borderColor,
                },
              ]}
            >
              {/* Left Visual Icon / Animation */}
              {card.category === 'diwali' && (
                <View style={styles.visualCol}>
                  <View style={styles.diyaWrapper}>
                    {/* Glowing Aura behind Diya */}
                    <Animated.View
                      style={[
                        styles.diyaGlowAura,
                        { transform: [{ scale: glowPulse }] },
                      ]}
                    />

                    {/* Flickering Flame */}
                    <Animated.View
                      style={[
                        styles.flameContainer,
                        {
                          transform: [
                            { scale: flameScale },
                            { translateY: flameTranslateY },
                          ],
                          opacity: flameOpacity,
                        },
                      ]}
                    >
                      <View style={styles.outerFlame} />
                      <View style={styles.innerFlame} />
                    </Animated.View>

                    {/* Diya Clay Base */}
                    <View style={styles.clayDiya}>
                      <View style={styles.diyaRim} />
                    </View>
                  </View>
                </View>
              )}

              {card.category === 'chhath' && (
                <View style={styles.visualCol}>
                  <View style={styles.chhathSunWrapper}>
                    <Animated.View
                      style={[
                        styles.sunGlowAura,
                        { transform: [{ scale: sunPulse }] },
                      ]}
                    />
                    <View style={styles.sunCircle}>
                      <Text style={styles.sunEmoji}>🌅</Text>
                    </View>
                  </View>
                </View>
              )}

              {card.category === 'campus' && (
                <View style={styles.visualCol}>
                  <View style={styles.campusIconWrapper}>
                    <View style={styles.campusBadge}>
                      <Text style={styles.campusEmoji}>🎓</Text>
                    </View>
                  </View>
                </View>
              )}

              {card.category === 'general' && (
                <View style={styles.visualCol}>
                  <View style={styles.campusIconWrapper}>
                    <View style={[styles.campusBadge, { backgroundColor: '#f0fdf4' }]}>
                      <Text style={styles.campusEmoji}>⚡</Text>
                    </View>
                  </View>
                </View>
              )}

              {/* Center Content Column */}
              <View style={styles.centerContent}>
                {/* Tag & Badges Row */}
                <View style={styles.tagRow}>
                  <Text style={[styles.festivalTag, { color: card.themeColor }]}>
                    {card.festivalTag}
                  </Text>

                  {/* Highlighted SELF RIDE Badge for Campus Ad */}
                  {card.isSelfRide && (
                    <Animated.View
                      style={[
                        styles.selfRideBadge,
                        { transform: [{ scale: campusBadgePulse }] },
                      ]}
                    >
                      <Text style={styles.selfRideBadgeText}>★ SELF RIDE ★</Text>
                    </Animated.View>
                  )}

                  <View
                    style={[
                      styles.discountBadge,
                      { backgroundColor: card.badgeBg },
                    ]}
                  >
                    <Text style={styles.discountBadgeText}>
                      {card.discountText}
                    </Text>
                  </View>
                </View>

                {/* Headline */}
                <Text style={styles.cardHeadline} numberOfLines={1}>
                  {card.headline}
                </Text>

                {/* Subtitle */}
                <Text style={styles.cardSubtitle} numberOfLines={1}>
                  {card.subtitle}
                </Text>
              </View>

              {/* Right Action / Promo Pill */}
              <TouchableOpacity
                style={[
                  styles.promoActionBtn,
                  isCopied && styles.promoActionBtnCopied,
                ]}
                onPress={() => {
                  handleApplyPromoCode(card.promoCode);
                  if (card.isSelfRide && onSelectCampusRide) {
                    onSelectCampusRide();
                  }
                }}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.promoActionText,
                    isCopied && styles.promoActionTextCopied,
                  ]}
                  numberOfLines={1}
                >
                  {isCopied ? 'APPLIED!' : card.promoCode}
                </Text>
                <Ionicons
                  name={isCopied ? 'checkmark-circle' : 'sparkles'}
                  size={12}
                  color={isCopied ? '#ffffff' : card.themeColor}
                />
              </TouchableOpacity>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    marginVertical: 8,
  },
  topMetaBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 6,
  },
  metaTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.6,
  },
  counterBadge: {
    backgroundColor: '#f1f5f9',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderWidth: 0.5,
    borderColor: '#cbd5e1',
  },
  counterText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#475569',
  },
  dotContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#cbd5e1',
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 12,
    paddingBottom: 4,
  },
  cardBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 10,
    paddingVertical: 9,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
    gap: 10,
  },
  visualCol: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  // 1. Diwali Diya Visuals
  diyaWrapper: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'flex-end',
    position: 'relative',
  },
  diyaGlowAura: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(251, 191, 36, 0.35)',
    top: 2,
  },
  flameContainer: {
    position: 'absolute',
    top: 2,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  outerFlame: {
    width: 14,
    height: 18,
    backgroundColor: '#f59e0b',
    borderTopLeftRadius: 7,
    borderTopRightRadius: 7,
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 5,
  },
  innerFlame: {
    position: 'absolute',
    bottom: 2,
    width: 7,
    height: 10,
    backgroundColor: '#fef08a',
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
  },
  clayDiya: {
    width: 34,
    height: 14,
    backgroundColor: '#b45309',
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    borderWidth: 1,
    borderColor: '#78350f',
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  diyaRim: {
    width: 26,
    height: 3,
    backgroundColor: '#f59e0b',
    borderRadius: 2,
    marginTop: 1,
  },

  // 2. Chhath Puja Sun Visuals
  chhathSunWrapper: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  sunGlowAura: {
    position: 'absolute',
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(249, 115, 22, 0.3)',
  },
  sunCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#ffedd5',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#fdba74',
  },
  sunEmoji: {
    fontSize: 18,
  },

  // 3. Campus Ride Visuals
  campusIconWrapper: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  campusBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#93c5fd',
  },
  campusEmoji: {
    fontSize: 18,
  },

  // Center Content
  centerContent: {
    flex: 1,
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
    flexWrap: 'nowrap',
  },
  festivalTag: {
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  selfRideBadge: {
    backgroundColor: '#059669',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  selfRideBadgeText: {
    fontSize: 7.5,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 0.4,
  },
  discountBadge: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  discountBadgeText: {
    fontSize: 7.5,
    fontWeight: '900',
    color: '#ffffff',
  },
  cardHeadline: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#0f172a',
  },
  cardSubtitle: {
    fontSize: 9.5,
    color: '#64748b',
    marginTop: 1,
  },

  // Promo Action Button
  promoActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 7,
    paddingHorizontal: 7,
    paddingVertical: 5,
    gap: 3,
  },
  promoActionBtnCopied: {
    backgroundColor: '#10b981',
    borderColor: '#059669',
  },
  promoActionText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: 0.4,
  },
  promoActionTextCopied: {
    color: '#ffffff',
  },
});
