import '../../src/utils/suppressWarnings';
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { api } from '../../src/services/api';
import { useAuthStore } from '../../src/store/authStore';

export default function AdminLoginScreen() {
  const router = useRouter();
  const { width: windowWidth } = useWindowDimensions();
  const { setAuth } = useAuthStore();

  const [phone, setPhone] = useState('+919999999999');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAdminLogin = async () => {
    if (!phone.trim()) {
      setError('Please enter Admin phone number or ID');
      return;
    }
    if (!password.trim()) {
      setError('Please enter Admin master password');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const cleanPhone = phone.trim().startsWith('+91')
        ? phone.trim()
        : `+91${phone.replace(/\D/g, '')}`;

      const res = await api.auth.login(cleanPhone, password.trim());
      const user = res.user;

      if (!user || user.role !== 'admin') {
        setError('Access Denied: This account does not possess Administrator privileges.');
        setLoading(false);
        return;
      }

      setAuth(user, res.access_token);
      router.replace('/(admin)');
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <StatusBar style="light" />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.loginCard, { maxWidth: Math.min(windowWidth - 32, 460) }]}>
          {/* Header Icon & Brand */}
          <View style={styles.headerBlock}>
            <View style={styles.iconCircle}>
              <Ionicons name="shield-checkmark" size={36} color="#3b82f6" />
            </View>
            <Text style={styles.brandTitle}>
              <Text style={{ color: '#3b82f6' }}>Indi</Text>
              <Text style={{ color: '#ffffff' }}>Ride</Text>
            </Text>
            <Text style={styles.portalBadge}>RESTRICTED ADMIN PORTAL</Text>
            <Text style={styles.subtitle}>
              Sign in with your master credentials to access the central dispatch, driver approvals & platform management console.
            </Text>
          </View>

          {/* Error Banner */}
          {error ? (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={18} color="#ef4444" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Phone / Admin ID */}
          <Text style={styles.fieldLabel}>ADMINISTRATOR PHONE / ID</Text>
          <View style={styles.inputBox}>
            <Ionicons name="call-outline" size={18} color="#64748b" style={styles.inputIcon} />
            <TextInput
              style={styles.inputField}
              value={phone}
              onChangeText={setPhone}
              placeholder="+919999999999"
              placeholderTextColor="#64748b"
              autoCapitalize="none"
            />
          </View>

          {/* Password */}
          <Text style={styles.fieldLabel}>MASTER PASSWORD</Text>
          <View style={styles.inputBox}>
            <Ionicons name="lock-closed-outline" size={18} color="#64748b" style={styles.inputIcon} />
            <TextInput
              style={styles.inputField}
              value={password}
              onChangeText={setPassword}
              placeholder="Enter master password"
              placeholderTextColor="#64748b"
              secureTextEntry={!showPassword}
              autoCapitalize="none"
            />
            <TouchableOpacity
              onPress={() => setShowPassword(!showPassword)}
              style={styles.eyeBtn}
              activeOpacity={0.7}
            >
              <Ionicons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={18}
                color="#94a3b8"
              />
            </TouchableOpacity>
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={styles.submitBtn}
            onPress={handleAdminLogin}
            disabled={loading}
            activeOpacity={0.88}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <View style={styles.submitBtnInner}>
                <Ionicons name="key" size={16} color="#ffffff" />
                <Text style={styles.submitBtnText}>Authenticate Admin Session</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Security Notice */}
          <View style={styles.noticeBox}>
            <Ionicons name="lock-closed" size={13} color="#94a3b8" />
            <Text style={styles.noticeText}>
              End-to-End Encrypted Session. Unauthorized login attempts are permanently logged and IP-restricted.
            </Text>
          </View>

          {/* Back to Home Link */}
          <TouchableOpacity
            style={styles.backHomeBtn}
            onPress={() => router.replace('/')}
          >
            <Text style={styles.backHomeText}>← Return to IndiRide Home</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090d16',
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 40,
  },
  loginCard: {
    width: '100%',
    backgroundColor: '#111827',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1e293b',
    paddingHorizontal: 24,
    paddingVertical: 32,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.45,
    shadowRadius: 24,
    elevation: 10,
  },
  headerBlock: {
    alignItems: 'center',
    marginBottom: 24,
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  brandTitle: {
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  portalBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: '#3b82f6',
    backgroundColor: '#1e3a8a',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    letterSpacing: 1,
    marginTop: 6,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 12,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#450a0a',
    borderWidth: 1,
    borderColor: '#991b1b',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 18,
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    color: '#fca5a5',
    fontWeight: '600',
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    paddingHorizontal: 12,
    marginBottom: 18,
  },
  inputIcon: {
    marginRight: 8,
  },
  inputField: {
    flex: 1,
    height: 46,
    fontSize: 14,
    color: '#ffffff',
  },
  eyeBtn: {
    padding: 6,
  },
  submitBtn: {
    backgroundColor: '#2563eb',
    height: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  submitBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  submitBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  noticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0f172a',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 16,
  },
  noticeText: {
    flex: 1,
    fontSize: 10,
    color: '#64748b',
    lineHeight: 14,
  },
  backHomeBtn: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  backHomeText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
});
