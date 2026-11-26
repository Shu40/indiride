import React from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

interface PendingDriverApprovalModalProps {
  visible: boolean;
  onClose: () => void;
  driverData?: {
    name?: string;
    phone?: string;
    state?: string;
    city?: string;
    license?: string;
    vehiclePlate?: string;
    submittedAt?: string;
  } | null;
}

export const PendingDriverApprovalModal: React.FC<PendingDriverApprovalModalProps> = ({
  visible,
  onClose,
  driverData,
}) => {
  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Header Icon */}
          <View style={styles.iconCircle}>
            <MaterialCommunityIcons name="clock-time-four-outline" size={44} color="#d97706" />
          </View>

          <Text style={styles.badge}>APPLICATION UNDER REVIEW</Text>
          <Text style={styles.title}>Wait for 7 Days Admin Approval</Text>
          <Text style={styles.subtitle}>
            Aapka driver registration & KYC verification request prapt ho gaya hai.
          </Text>

          {/* 7 Days Wait Notice Banner */}
          <View style={styles.noticeBox}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
              <Ionicons name="shield-checkmark" size={18} color="#b45309" style={{ marginRight: 6 }} />
              <Text style={styles.noticeHeading}>7 Working Days Verification Period</Text>
            </View>
            <Text style={styles.noticeBody}>
              Hamari verification team aapke <Text style={{ fontWeight: '700' }}>Driver Photo (JPEG), Driving License, PAN Card, aur Aadhaar Card</Text> ki janch kar rahi hai.
            </Text>
            <Text style={[styles.noticeBody, { marginTop: 6, fontWeight: '700', color: '#92400e' }]}>
              ⏳ Jab tak Admin documents approve nahi karta, tab tak ride accept nahi kar sakenge. Approved hone ke baad aap is mobile number se dobara login kar sakenge.
            </Text>
          </View>

          {/* Details Summary Card */}
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>SUBMISSION DETAILS</Text>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Applicant Name:</Text>
              <Text style={styles.summaryValue}>{driverData?.name || 'Driver Partner'}</Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Mobile Number:</Text>
              <Text style={styles.summaryValue}>{driverData?.phone || '+91'}</Text>
            </View>

            {driverData?.state ? (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Operating Location:</Text>
                <Text style={styles.summaryValue}>
                  {driverData.city ? `${driverData.city}, ` : ''}{driverData.state}
                </Text>
              </View>
            ) : null}

            {driverData?.license ? (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Driving License:</Text>
                <Text style={styles.summaryValue}>{driverData.license}</Text>
              </View>
            ) : null}

            {driverData?.vehiclePlate ? (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Vehicle Plate:</Text>
                <Text style={styles.summaryValue}>{driverData.vehiclePlate}</Text>
              </View>
            ) : null}

            <View style={[styles.summaryRow, { borderBottomWidth: 0 }]}>
              <Text style={styles.summaryLabel}>Status:</Text>
              <View style={styles.statusPill}>
                <Text style={styles.statusPillText}>⏳ PENDING (7 Days Wait)</Text>
              </View>
            </View>
          </View>

          {/* Close / Return to Login Button */}
          <TouchableOpacity style={styles.actionBtn} onPress={onClose} activeOpacity={0.88}>
            <Ionicons name="arrow-back-circle-outline" size={20} color="#ffffff" style={{ marginRight: 8 }} />
            <Text style={styles.actionBtnText}>Return to Home / Login (लॉगिन पर लौटें)</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    boxShadow: '0 15px 30px rgba(0,0,0,0.25)',
  },
  iconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#fef3c7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#fde68a',
  },
  badge: {
    fontSize: 11,
    fontWeight: '800',
    color: '#b45309',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 14,
  },
  noticeBox: {
    width: '100%',
    backgroundColor: '#fffbeb',
    borderWidth: 1.5,
    borderColor: '#fcd34d',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  noticeHeading: {
    fontSize: 13,
    fontWeight: '800',
    color: '#92400e',
  },
  noticeBody: {
    fontSize: 12,
    color: '#78350f',
    lineHeight: 17,
  },
  summaryCard: {
    width: '100%',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    marginBottom: 18,
  },
  summaryTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748b',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  summaryValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
  },
  statusPill: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#b45309',
  },
  actionBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    paddingVertical: 13,
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
});
