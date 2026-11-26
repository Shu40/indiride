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

interface PlayStoreComingSoonModalProps {
  visible: boolean;
  onClose: () => void;
}

export const PlayStoreComingSoonModal: React.FC<PlayStoreComingSoonModalProps> = ({
  visible,
  onClose,
}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={styles.playIconContainer}>
                <Ionicons name="logo-google-playstore" size={24} color="#059669" />
              </View>
              <View>
                <Text style={styles.title}>Google Play Store</Text>
                <Text style={styles.subTitle}>Android APK Launch Roadmap</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color="#64748b" />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
            {/* Status Banner */}
            <View style={styles.statusBanner}>
              <View style={styles.pulsingDot} />
              <Text style={styles.statusBannerText}>
                Android APK Launching Tomorrow • Web Version Live Today!
              </Text>
            </View>

            {/* Launch Timeline */}
            <View style={styles.timelineContainer}>
              <View style={styles.timelineRow}>
                <View style={[styles.timelineBadge, { backgroundColor: '#dcfce7' }]}>
                  <Ionicons name="checkmark" size={16} color="#16a34a" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.timelineHeading}>Today: Production Web App Live</Text>
                  <Text style={styles.timelineDesc}>
                    Full bike, auto, and cab booking, live GPS driver tracking, and instant OTP verification is available right now in your mobile browser.
                  </Text>
                </View>
              </View>

              <View style={styles.timelineDivider} />

              <View style={styles.timelineRow}>
                <View style={[styles.timelineBadge, { backgroundColor: '#fef3c7' }]}>
                  <Ionicons name="time" size={16} color="#d97706" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.timelineHeading}>Tomorrow: Android APK Release</Text>
                  <Text style={styles.timelineDesc}>
                    Direct Android APK package will be released for 1-click download on iniride.com while Google Play Store review completes.
                  </Text>
                </View>
              </View>

              <View style={styles.timelineDivider} />

              <View style={styles.timelineRow}>
                <View style={[styles.timelineBadge, { backgroundColor: '#e0f2fe' }]}>
                  <Ionicons name="cloud-done" size={16} color="#0284c7" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.timelineHeading}>Play Store Listing</Text>
                  <Text style={styles.timelineDesc}>
                    Official listing on Google Play Store with automated updates and offline notifications.
                  </Text>
                </View>
              </View>
            </View>

            {/* How to use like an App Today (PWA) */}
            <View style={styles.pwaBox}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <MaterialCommunityIcons name="cellphone-arrow-down" size={20} color="#0369a1" />
                <Text style={styles.pwaTitle}>How to install as App today:</Text>
              </View>
              <Text style={styles.pwaStep}>1. Open this website in Google Chrome on your phone.</Text>
              <Text style={styles.pwaStep}>2. Tap the ⋮ (three dots menu) at the top right.</Text>
              <Text style={styles.pwaStep}>3. Select "Add to Home screen" or "Install App".</Text>
              <Text style={styles.pwaStep}>4. IndiRide will open in full-screen just like a Play Store app!</Text>
            </View>
          </ScrollView>

          <TouchableOpacity style={styles.actionBtn} onPress={onClose}>
            <Text style={styles.actionBtnText}>Got it, Continue on Web</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    width: '100%',
    maxWidth: 480,
    padding: 20,
    ...Platform.select({
      web: {
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
      },
    }),
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    marginBottom: 16,
  },
  playIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
  },
  subTitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 1,
  },
  closeBtn: {
    padding: 6,
    backgroundColor: '#f1f5f9',
    borderRadius: 20,
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 8,
    marginBottom: 16,
  },
  pulsingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#16a34a',
  },
  statusBannerText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#15803d',
    flex: 1,
  },
  timelineContainer: {
    marginBottom: 16,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  timelineBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  timelineHeading: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  timelineDesc: {
    fontSize: 12,
    color: '#64748b',
    lineHeight: 18,
    marginTop: 2,
  },
  timelineDivider: {
    width: 2,
    height: 18,
    backgroundColor: '#e2e8f0',
    marginLeft: 13,
    marginVertical: 4,
  },
  pwaBox: {
    backgroundColor: '#f0f9ff',
    borderWidth: 1,
    borderColor: '#bae6fd',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  pwaTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0369a1',
  },
  pwaStep: {
    fontSize: 12,
    color: '#0c4a6e',
    lineHeight: 19,
  },
  actionBtn: {
    backgroundColor: '#059669',
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 6,
  },
  actionBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
});
