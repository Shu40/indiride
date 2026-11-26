import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../services/api';
import { FestivalCampaign } from '../types';

interface FestivalMiniPopupProps {
  onApplyPromo?: (code: string) => void;
}

export const FestivalMiniPopup: React.FC<FestivalMiniPopupProps> = ({ onApplyPromo }) => {
  const [campaign, setCampaign] = useState<FestivalCampaign | null>(null);

  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pulseAnim] = useState(new Animated.Value(1));

  // Fetch live active campaign from backend (admin configured)
  useEffect(() => {
    let isMounted = true;
    async function loadCampaign() {
      try {
        const res: any = await api.festival.getPublic();
        if (isMounted && res) {
          const c = res.campaign || res;
          if (c && c.is_active === true) {
            setCampaign({
              festival_name: c.festival_name || 'Special Offer',
              banner_title: c.banner_title || c.festival_name || '🎉 Special Offer',
              banner_subtitle:
                c.banner_subtitle ||
                c.tagline ||
                'Exclusive limited-time discount on all rides!',
              discount_percent: c.discount_percent || 10,
              promo_code: c.promo_code || 'OFFER10',
              is_active: true,
              theme_color: c.theme_color || '#d97706',
            });
          } else {
            setCampaign(null);
          }
        }
      } catch (err) {
        if (isMounted) setCampaign(null);
      }
    }
    loadCampaign();

    const useNativeDriver = Platform.OS !== 'web';

    // Pulse animation for festival badge
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1200,
          useNativeDriver,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver,
        }),
      ])
    ).start();

    return () => {
      isMounted = false;
    };
  }, []);

  if (!campaign || !campaign.is_active) {
    return null;
  }

  const handleCopyCode = () => {
    setCopied(true);
    if (onApplyPromo) {
      onApplyPromo(campaign.promo_code);
    }
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <View style={[styles.floatingContainer, { pointerEvents: 'box-none' } as any]}>
      {!expanded ? (
        // Mini Floating Pill (Non-intrusive, animated)
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <TouchableOpacity
            style={styles.floatingPill}
            onPress={() => setExpanded(true)}
            activeOpacity={0.88}
          >
            <View style={styles.diyaCircle}>
              <Text style={styles.diyaEmoji}>🪔</Text>
            </View>
            <View style={styles.pillTextContainer}>
              <View style={styles.pillTagRow}>
                <Text style={styles.pillTag}>{campaign.festival_name.toUpperCase()} SPECIAL</Text>
                <Text style={styles.pillDiscount}>{campaign.discount_percent}% OFF</Text>
              </View>
              <Text style={styles.pillTitle} numberOfLines={1}>
                Code: {campaign.promo_code}
              </Text>
            </View>
            <Ionicons name="chevron-down" size={16} color="#d97706" style={{ marginLeft: 4 }} />
          </TouchableOpacity>
        </Animated.View>
      ) : (
        // Expanded Festive Card (Interactive details)
        <View style={styles.expandedCard}>
          <View style={styles.cardHeader}>
            <View style={styles.headerLeft}>
              <Text style={styles.cardHeaderEmoji}>🪔</Text>
              <View>
                <Text style={styles.cardFestivalTag}>
                  {campaign.festival_name.toUpperCase()} CELEBRATION
                </Text>
                <Text style={styles.cardTitle}>{campaign.banner_title}</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={() => setExpanded(false)}
            >
              <Ionicons name="close" size={18} color="#64748b" />
            </TouchableOpacity>
          </View>

          <Text style={styles.cardSubtitle}>{campaign.banner_subtitle}</Text>

          {/* Promo Code Box */}
          <View style={styles.promoBox}>
            <View style={styles.codeDetails}>
              <Text style={styles.promoCodeLabel}>PROMO CODE</Text>
              <Text style={styles.promoCodeVal}>{campaign.promo_code}</Text>
            </View>
            <TouchableOpacity
              style={[styles.copyBtn, copied && styles.copiedBtn]}
              onPress={handleCopyCode}
              activeOpacity={0.8}
            >
              <Ionicons
                name={copied ? 'checkmark-circle' : 'copy-outline'}
                size={14}
                color={copied ? '#ffffff' : '#92400e'}
              />
              <Text style={[styles.copyBtnText, copied && styles.copiedBtnText]}>
                {copied ? 'Applied!' : 'Copy Code'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.benefitRow}>
            <View style={styles.bulletItem}>
              <Ionicons name="flash" size={12} color="#f59e0b" />
              <Text style={styles.bulletText}>Save {campaign.discount_percent}% on all rides</Text>
            </View>
            <View style={styles.bulletItem}>
              <Ionicons name="shield-checkmark" size={12} color="#10b981" />
              <Text style={styles.bulletText}>Zero Surge pricing</Text>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  floatingContainer: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 999,
    maxWidth: 380,
  },
  floatingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 251, 235, 0.95)',
    borderWidth: 1.5,
    borderColor: '#f59e0b',
    borderRadius: 30,
    paddingVertical: 7,
    paddingHorizontal: 12,
    shadowColor: '#d97706',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
    gap: 8,
  },
  diyaCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#fef3c7',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  diyaEmoji: {
    fontSize: 16,
  },
  pillTextContainer: {
    flexDirection: 'column',
  },
  pillTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pillTag: {
    fontSize: 10,
    fontWeight: '800',
    color: '#b45309',
    letterSpacing: 0.5,
  },
  pillDiscount: {
    fontSize: 10,
    fontWeight: '900',
    color: '#059669',
    backgroundColor: '#d1fae5',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  pillTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#78350f',
  },
  expandedCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 16,
    width: 320,
    borderWidth: 1.5,
    borderColor: '#f59e0b',
    shadowColor: '#d97706',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  cardHeaderEmoji: {
    fontSize: 22,
  },
  cardFestivalTag: {
    fontSize: 10,
    fontWeight: '900',
    color: '#b45309',
    letterSpacing: 0.8,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  closeBtn: {
    padding: 4,
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 17,
    marginBottom: 12,
  },
  promoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fcd34d',
    borderStyle: 'dashed',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
  },
  codeDetails: {
    flexDirection: 'column',
  },
  promoCodeLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#92400e',
    letterSpacing: 0.5,
  },
  promoCodeVal: {
    fontSize: 15,
    fontWeight: '900',
    color: '#78350f',
    letterSpacing: 1,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fde68a',
    gap: 4,
  },
  copiedBtn: {
    backgroundColor: '#10b981',
    borderColor: '#059669',
  },
  copyBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#92400e',
  },
  copiedBtnText: {
    color: '#ffffff',
  },
  benefitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  bulletItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  bulletText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
  },
});
