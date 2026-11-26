import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

interface FounderStoryModalProps {
  visible: boolean;
  onClose: () => void;
}

export const FounderStoryModal: React.FC<FounderStoryModalProps> = ({
  visible,
  onClose,
}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>🇮🇳 BORN IN BIHAR • SERVING BHARAT</Text>
              </View>
              <Text style={styles.title}>About IndiRide & Founder</Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="close" size={22} color="#0f172a" />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.contentScroll}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 32 }}
          >
            {/* Founder Card */}
            <View style={styles.founderCard}>
              <View style={styles.founderAvatarBox}>
                <Ionicons name="person" size={36} color="#0284c7" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.founderName}>Shubham Kumar</Text>
                <Text style={styles.founderRole}>Founder & CEO, IndiRide</Text>
                <View style={styles.locationPill}>
                  <Ionicons name="location-sharp" size={13} color="#0369a1" />
                  <Text style={styles.locationPillText}>Bihar, India</Text>
                </View>
              </View>
            </View>

            {/* Mission & Vision Quote */}
            <View style={styles.quoteBox}>
              <Text style={styles.quoteText}>
                "Humara lakshya Bihar aur pure desh ke har shahar me sasti, surakshit aur transparent ride seva uplabdh karana hai. Rapido, Ola, Uber ke aniyamit fares aur high cancellation rates ke viprit, IndiRide local drivers aur yatriyon ke beech sidha, fair connection banata hai."
              </Text>
              <Text style={styles.quoteAuthor}>— Shubham Kumar, Founder</Text>
            </View>

            {/* Core Pillars */}
            <Text style={styles.sectionHeading}>Why IndiRide? (Humari Visheshata)</Text>

            <View style={styles.featuresGrid}>
              <View style={styles.featureItem}>
                <View style={[styles.iconBox, { backgroundColor: '#e0f2fe' }]}>
                  <MaterialCommunityIcons name="motorbike" size={24} color="#0284c7" />
                </View>
                <Text style={styles.featureTitle}>₹7 / km Bike Taxi</Text>
                <Text style={styles.featureSub}>
                  Bihar ka sabse kifayati bike safar. Students aur daily commuters ke liye behtareen.
                </Text>
              </View>

              <View style={styles.featureItem}>
                <View style={[styles.iconBox, { backgroundColor: '#fef3c7' }]}>
                  <MaterialCommunityIcons name="rickshaw" size={24} color="#d97706" />
                </View>
                <Text style={styles.featureTitle}>₹10 / km Auto Rickshaw</Text>
                <Text style={styles.featureSub}>
                  Pura meter system, zero unfair surge pricing aur turant booking.
                </Text>
              </View>

              <View style={styles.featureItem}>
                <View style={[styles.iconBox, { backgroundColor: '#dcfce7' }]}>
                  <Ionicons name="car-sport" size={24} color="#16a34a" />
                </View>
                <Text style={styles.featureTitle}>₹15 / km Car Cab</Text>
                <Text style={styles.featureSub}>
                  AC clean sedans & hatchbacks, parivaar aur lambi yatra ke liye.
                </Text>
              </View>

              <View style={styles.featureItem}>
                <View style={[styles.iconBox, { backgroundColor: '#f3e8ff' }]}>
                  <Ionicons name="shield-checkmark" size={24} color="#9333ea" />
                </View>
                <Text style={styles.featureTitle}>4-Digit Pickup PIN</Text>
                <Text style={styles.featureSub}>
                  HMAC-SHA256 encrypted PIN. Jab tak driver PIN verify nahi karega, trip shuru nahi hogi.
                </Text>
              </View>
            </View>

            {/* Verification & Trust */}
            <View style={styles.trustBanner}>
              <Ionicons name="phone-portrait-outline" size={22} color="#0284c7" />
              <View style={{ flex: 1 }}>
                <Text style={styles.trustTitle}>100% Real Mobile Verified</Text>
                <Text style={styles.trustSub}>
                  Har rider aur passenger real Indian SMS OTP dwara verified hota hai, jisse safety 100% guaranteed rehti hai.
                </Text>
              </View>
            </View>

            {/* Contact & Bihar Operations */}
            <View style={styles.contactCard}>
              <Text style={styles.contactTitle}>Headquarters & Operations</Text>
              <Text style={styles.contactItem}>📍 State Operations: Bihar, India</Text>
              <Text style={styles.contactItem}>📧 Email: support@iniride.com</Text>
              <Text style={styles.contactItem}>🌐 Web: https://iniride.com</Text>
            </View>

            <TouchableOpacity style={styles.actionBtn} onPress={onClose}>
              <Text style={styles.actionBtnText}>Close & Continue</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingHorizontal: 20,
    paddingTop: 18,
    ...Platform.select({
      web: {
        maxWidth: 580,
        alignSelf: 'center',
        width: '100%',
        borderRadius: 24,
        marginBottom: 20,
      },
    }),
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  headerLeft: {
    flex: 1,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0369a1',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
  },
  closeBtn: {
    padding: 6,
    backgroundColor: '#f1f5f9',
    borderRadius: 20,
    marginLeft: 12,
  },
  contentScroll: {
    marginTop: 14,
  },
  founderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
    gap: 14,
  },
  founderAvatarBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#e0f2fe',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#bae6fd',
  },
  founderName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  founderRole: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  locationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e0f2fe',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 6,
    gap: 4,
  },
  locationPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0369a1',
  },
  quoteBox: {
    backgroundColor: '#f0f9ff',
    borderLeftWidth: 4,
    borderLeftColor: '#0284c7',
    padding: 14,
    borderRadius: 10,
    marginBottom: 20,
  },
  quoteText: {
    fontSize: 13,
    lineHeight: 20,
    color: '#0c4a6e',
    fontStyle: 'italic',
  },
  quoteAuthor: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0284c7',
    marginTop: 8,
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 12,
  },
  featuresGrid: {
    gap: 10,
    marginBottom: 20,
  },
  featureItem: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  featureTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 3,
  },
  featureSub: {
    fontSize: 12,
    color: '#64748b',
    lineHeight: 18,
  },
  trustBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    gap: 12,
    marginBottom: 20,
  },
  trustTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1e3a8a',
  },
  trustSub: {
    fontSize: 11,
    color: '#3b82f6',
    lineHeight: 16,
    marginTop: 2,
  },
  contactCard: {
    backgroundColor: '#f8fafc',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 20,
  },
  contactTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 6,
  },
  contactItem: {
    fontSize: 12,
    color: '#475569',
    marginTop: 3,
  },
  actionBtn: {
    backgroundColor: '#0284c7',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  actionBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
});
