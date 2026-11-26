import '../../src/utils/suppressWarnings';
import React, { useState, useEffect } from 'react';
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
  Modal,
  Alert,
  Image,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { api } from '../../src/services/api';
import { useAuthStore } from '../../src/store/authStore';
import { UserRole } from '../../src/types';
import { LoginHeroVideo } from '../../src/components/LoginHeroVideo';
import { FounderStoryModal } from '../../src/components/FounderStoryModal';
import { PlayStoreComingSoonModal } from '../../src/components/PlayStoreComingSoonModal';

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const { setAuth, logout, isAuthenticated, user } = useAuthStore();

  // If user enters login screen with stale admin credentials, reset so they aren't trapped into admin
  useEffect(() => {
    if (isAuthenticated && user?.role === 'admin') {
      logout();
    }
  }, [isAuthenticated, user?.role]);

  // Navigation view mode: 'welcome' | 'login' | 'signup' | 'otp' | 'name_entry' | 'google_phone_link'
  const [viewMode, setViewMode] = useState<'welcome' | 'login' | 'signup' | 'otp' | 'name_entry' | 'google_phone_link'>('welcome');
  const [role, setRole] = useState<UserRole>('passenger');

  // Input states
  const [phone, setPhone] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Driver partner fields & KYC details
  const [licenseNumber, setLicenseNumber] = useState('');
  const [vehicleCategory, setVehicleCategory] = useState<'bike' | 'bullet' | 'car' | 'auto'>('bike');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [vehicleModel, setVehicleModel] = useState('Hero Splendor Plus');
  const [riderServiceType, setRiderServiceType] = useState<'REGULAR' | 'CAMPUS'>('CAMPUS');
  const [servedUniversities, setServedUniversities] = useState('Parul University, Vadodara');
  const [collegeName, setCollegeName] = useState('Parul University');
  const [academicYear, setAcademicYear] = useState('Final Year (2024-25)');
  const [studentIdNumber, setStudentIdNumber] = useState('');
  const [studentIdPhoto, setStudentIdPhoto] = useState<string>('');
  const [permanentAddress, setPermanentAddress] = useState('');
  const [currentAddress, setCurrentAddress] = useState('');
  const [sameAddress, setSameAddress] = useState(false);
  const [passportPhoto, setPassportPhoto] = useState<string>('');
  const [licensePhoto, setLicensePhoto] = useState<string>('');
  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [aadhaarPhoto, setAadhaarPhoto] = useState<string>('');

  const handlePickDocument = (type: 'passport' | 'license' | 'aadhaar' | 'student_id') => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = (e: any) => {
        const file = e.target?.files?.[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = () => {
            const res = reader.result as string;
            if (type === 'passport') setPassportPhoto(res);
            else if (type === 'license') setLicensePhoto(res);
            else if (type === 'student_id') setStudentIdPhoto(res);
            else setAadhaarPhoto(res);
          };
          reader.readAsDataURL(file);
        }
      };
      input.click();
    } else {
      Alert.alert('Upload Photo', 'Please choose a clear photo of your document from your gallery.');
    }
  };

  // Resend OTP Countdown & Rate Limiting
  const [resendTimer, setResendTimer] = useState(0);
  const [resendCount, setResendCount] = useState(0);
  const MAX_RESENDS = 5;

  // Google Sign-In & Modals
  const [googleModalVisible, setGoogleModalVisible] = useState(false);
  const [googleEmailInput, setGoogleEmailInput] = useState('');
  const [googleNameInput, setGoogleNameInput] = useState('');
  const [googleComingSoonNotice, setGoogleComingSoonNotice] = useState(false);
  const [savedGoogleAccount, setSavedGoogleAccount] = useState<{ email: string; name: string } | null>(null);
  const [pendingGoogleEmail, setPendingGoogleEmail] = useState('');
  const [pendingGoogleName, setPendingGoogleName] = useState('');
  const [founderModalVisible, setFounderModalVisible] = useState(false);
  const [playStoreModalVisible, setPlayStoreModalVisible] = useState(false);
  const [findAccountModal, setFindAccountModal] = useState(false);
  const [searchIdent, setSearchIdent] = useState('');
  const [foundAccount, setFoundAccount] = useState<any>(null);
  const [findLoading, setFindLoading] = useState(false);

  // Load saved Google Account from browser localStorage if available
  useEffect(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const saved = window.localStorage.getItem('ini_last_google_account');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed?.email) {
            setSavedGoogleAccount(parsed);
            setGoogleEmailInput(parsed.email);
            setGoogleNameInput(parsed.name || '');
          }
        }
      } catch {
        // Fallback gracefully
      }
    }
  }, []);

  // 60-Second Countdown Timer Effect for Resend OTP
  useEffect(() => {
    let interval: any = null;
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [resendTimer]);

  const cleanPhoneInput = (val: string) => {
    return val.replace(/\D/g, '').slice(0, 10);
  };

  const getFullPhoneNumber = () => {
    const raw = cleanPhoneInput(phone);
    return `+91${raw}`;
  };

  // 1. Send / Resend OTP
  const handleSendOtp = async (isResend = false) => {
    const rawPhone = cleanPhoneInput(phone);
    if (!rawPhone || rawPhone.length !== 10) {
      setError('Please enter a valid 10-digit Indian mobile number');
      return;
    }

    if (viewMode === 'signup') {
      if (!fullName.trim()) {
        setError('Please enter your full name to create an account');
        return;
      }
      if (role === 'rider') {
        if (!licenseNumber.trim()) {
          setError('Driving License number is required for Driver registration');
          return;
        }
        if (!vehiclePlate.trim()) {
          setError('Vehicle registration plate number is required');
          return;
        }
      }
    }

    if (isResend) {
      if (resendCount >= MAX_RESENDS) {
        setError(`Maximum resend limit (${MAX_RESENDS}/${MAX_RESENDS}) reached. Please try again later.`);
        return;
      }
      if (resendTimer > 0) {
        return;
      }
    }

    setError('');
    setLoading(true);
    const fullPhone = getFullPhoneNumber();

    if (viewMode === 'login') {
      try {
        const acc = await api.auth.findAccount(fullPhone);
        if (!acc.found) {
          setError('Yeh mobile number registered nahi mila. Kripya pehle "Create an Account" par jakar Sign Up karein.');
          setLoading(false);
          return;
        }
      } catch {
        // Continue if findAccount fails so standard verify handles it
      }
    }

    try {
      const otpResp = await api.auth.sendOtp(fullPhone);
      setViewMode('otp');
      setOtp(''); // Strict security: OTP must never be auto-filled, user must enter code from real SMS
      setResendTimer(60); // 1-minute countdown
      if (isResend) {
        setResendCount((prev) => prev + 1);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to send verification OTP');
    } finally {
      setLoading(false);
    }
  };

  // 2. Verify OTP & Log In / Sign Up
  const handleVerifyOtp = async () => {
    if (!otp || otp.trim().length < 6) {
      setError('Please enter the complete 6-digit OTP code');
      return;
    }
    setError('');
    setLoading(true);
    const fullPhone = getFullPhoneNumber();

    try {
      // Strictly verify user input against Redis HMAC hash without any fallback
      const verifyResp: any = await api.auth.verifyOtp(fullPhone, otp.trim());
      const tokenData = verifyResp.token || verifyResp.tokens;

      // Prevent login if account does not exist
      if (!tokenData && !verifyResp.registered && viewMode === 'login') {
        setError('Yeh account registered nahi mila. Kripya pehle "Create an Account" par jakar Sign Up karein.');
        setLoading(false);
        return;
      }

      // Check if driver partner is logging in
      if (tokenData) {
        setAuth(tokenData.user, tokenData.access_token);

        if (role === 'rider' || tokenData.user.role === 'rider') {
          // If rider is approved by admin, they go straight to live dashboard
          if (tokenData.user.rider_profile?.status === 'approved') {
            redirectByRole('rider');
            return;
          }

          // If rider application is already submitted and pending admin janch/review:
          if (tokenData.user.rider_profile?.status === 'pending') {
            redirectByRole('rider');
            return;
          }

          // Otherwise (new driver, incomplete KYC, or rejected):
          // Open the Driver Registration & KYC Form right after login!
          setRole('rider');
          if (tokenData.user.full_name && tokenData.user.full_name !== 'Rider User' && tokenData.user.full_name.trim().toLowerCase() !== 'rider') {
            setFullName(tokenData.user.full_name);
          }
          if (tokenData.user.email) setEmail(tokenData.user.email);
          if (tokenData.user.rider_profile?.license_number) {
            setLicenseNumber(tokenData.user.rider_profile.license_number);
          }
          if (tokenData.user.rider_profile?.aadhaar_number) {
            setAadhaarNumber(tokenData.user.rider_profile.aadhaar_number);
          }
          if (tokenData.user.rider_profile?.permanent_address) {
            setPermanentAddress(tokenData.user.rider_profile.permanent_address);
          }
          if (tokenData.user.rider_profile?.current_address) {
            setCurrentAddress(tokenData.user.rider_profile.current_address);
          }
          if (tokenData.user.rider_profile?.passport_photo) {
            setPassportPhoto(tokenData.user.rider_profile.passport_photo);
          }
          if (tokenData.user.rider_profile?.license_photo) {
            setLicensePhoto(tokenData.user.rider_profile.license_photo);
          }
          if (tokenData.user.rider_profile?.aadhaar_photo) {
            setAadhaarPhoto(tokenData.user.rider_profile.aadhaar_photo);
          }
          setViewMode('name_entry');
          return;
        }

        // Passenger or Admin with valid name
        if (
          tokenData.user?.full_name &&
          tokenData.user.full_name !== 'Rider User' &&
          tokenData.user.full_name.trim().toLowerCase() !== 'rider'
        ) {
          redirectByRole(tokenData.user.role);
          return;
        }
      }

      // If registered with placeholder name or not registered yet, proceed to name entry step
      setViewMode('name_entry');
    } catch (err: any) {
      setError(err.message || 'Invalid verification code. Please check and try again.');
    } finally {
      setLoading(false);
    }
  };

  // 3. Complete Name & Profile Setup after OTP verification
  const handleCompleteNameEntry = async () => {
    if (!fullName.trim()) {
      setError('Please enter your full name to continue');
      return;
    }
    const rawPhone = cleanPhoneInput(phone);
    if (!rawPhone || rawPhone.length !== 10) {
      setError('Please enter a valid 10-digit Indian mobile number');
      return;
    }
    setError('');
    setLoading(true);
    const fullPhone = `+91${rawPhone}`;

    try {
      const payload: any = {
        phone_number: fullPhone,
        full_name: fullName.trim(),
        email: email.trim() || undefined,
        role,
      };

      if (role === 'rider') {
        if (riderServiceType === 'CAMPUS') {
          if (!collegeName.trim()) {
            setError('Please enter your College or University name');
            setLoading(false);
            return;
          }
          if (!vehiclePlate.trim()) {
            setError('Please enter your Vehicle Number (Gadi Number)');
            setLoading(false);
            return;
          }
          const cleanAadhaar = aadhaarNumber.replace(/\D/g, '');
          if (!cleanAadhaar || cleanAadhaar.length < 12) {
            setError('Please enter your complete 12-digit Aadhaar Card number');
            setLoading(false);
            return;
          }
          if (!studentIdNumber.trim()) {
            setError('Please enter your Student ID Card Number or Roll Number');
            setLoading(false);
            return;
          }

          payload.rider_service_type = 'CAMPUS';
          payload.college_name = collegeName.trim();
          payload.served_universities = collegeName.trim();
          payload.academic_year = academicYear.trim() || 'Current Academic Year';
          payload.student_id_number = studentIdNumber.trim();
          payload.student_id_photo = studentIdPhoto || 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=400';
          payload.aadhaar_number = aadhaarNumber.trim();
          payload.aadhaar_photo = aadhaarPhoto || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400';
          payload.vehicle_category = vehicleCategory;
          payload.vehicle_plate = vehiclePlate.trim().toUpperCase();
          payload.vehicle_model = vehicleModel.trim() || 'Hero Splendor Plus';
          payload.license_number = licenseNumber.trim() ? licenseNumber.trim().toUpperCase() : `CAMPUS-ID-${cleanAadhaar.slice(-6)}`;
        } else {
          if (!licenseNumber.trim()) {
            setError('Please enter your Driving License number');
            setLoading(false);
            return;
          }
          const cleanAadhaar = aadhaarNumber.replace(/\D/g, '');
          if (!cleanAadhaar || cleanAadhaar.length < 12) {
            setError('Please enter your complete 12-digit Aadhaar Card number');
            setLoading(false);
            return;
          }
          if (!vehiclePlate.trim()) {
            setError('Please enter your Vehicle Plate number (e.g. KA-01-EK-8892)');
            setLoading(false);
            return;
          }
          if (!permanentAddress.trim()) {
            setError('Please enter your Permanent Address');
            setLoading(false);
            return;
          }

          payload.rider_service_type = 'REGULAR';
          payload.license_number = licenseNumber.trim().toUpperCase();
          payload.aadhaar_number = aadhaarNumber.trim();
          payload.vehicle_category = vehicleCategory;
          payload.vehicle_plate = vehiclePlate.trim().toUpperCase();
          payload.vehicle_model = vehicleModel.trim() || 'Hero Splendor Plus';
          payload.permanent_address = permanentAddress.trim();
          payload.current_address = sameAddress ? permanentAddress.trim() : (currentAddress.trim() || permanentAddress.trim());
          payload.passport_photo = passportPhoto || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300';
          payload.license_photo = licensePhoto || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=300';
          payload.aadhaar_photo = aadhaarPhoto || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=300';
        }
      }

      const regResp = await api.auth.register(payload);
      setAuth(regResp.user, regResp.access_token);
      redirectByRole(regResp.user.role);
    } catch (err: any) {
      setError(err.message || 'Failed to submit registration. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const redirectByRole = (userRole: UserRole) => {
    if (userRole === 'rider') {
      router.replace('/(rider)');
    } else if (userRole === 'admin') {
      router.replace('/(admin)');
    } else {
      router.replace('/(passenger)');
    }
  };

  // Demo Login & Test Functions requested by user
  const handleDemoLogin = async (targetRole: 'rider' | 'passenger' | 'admin' | 'rider_pending' | 'campus_rider' | string) => {
    setError('');
    setLoading(true);
    try {
      const res: any = await api.auth.demoLogin(targetRole);
      setAuth(res.user, res.access_token);
      redirectByRole(res.user.role);
    } catch (err: any) {
      setError(err.message || 'Demo login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenRegistrationFormDemo = () => {
    setError('');
    setRole('rider');
    setFullName('Rajesh Kumar (New Driver)');
    setPhone('9876543210');
    setEmail('rajesh.driver@gmail.com');
    setLicenseNumber('DL-04-2024-884422');
    setVehiclePlate('DL-01-AB-9922');
    setVehicleModel('Hero Splendor Plus');
    setPermanentAddress('House 45, Gali No. 3, Shakarpur, New Delhi 110092');
    setCurrentAddress('Room 12, Atta Village, Sector 27, Noida 201301');
    setSameAddress(false);
    setPassportPhoto('https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300');
    setLicensePhoto('https://images.unsplash.com/photo-1578632767115-351597cf2477?w=300');
    setAadhaarNumber('5432 8901 2345');
    setAadhaarPhoto('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=300');
    setViewMode('name_entry');
  };

  // Google Auth Flow
  const handleSelectGoogleAccount = async (overrideEmail?: string, overrideName?: string) => {
    const targetEmail = (overrideEmail || googleEmailInput).trim().toLowerCase();
    const targetName = (overrideName || googleNameInput).trim() || 'Google User';

    if (!targetEmail) {
      Alert.alert('Required', 'Please enter your Google Email address');
      return;
    }
    setGoogleModalVisible(false);
    setLoading(true);
    setError('');

    try {
      const resp = await api.auth.googleAuth({
        email: targetEmail,
        full_name: targetName,
      });
      if (resp.tokens || resp.token) {
        // Remember this Google account for 1-click next time!
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem('ini_last_google_account', JSON.stringify({ email: targetEmail, name: targetName }));
        }
        const tokenData = resp.tokens || resp.token;
        setAuth(tokenData.user, tokenData.access_token);
        redirectByRole(tokenData.user.role);
      } else if (resp.phone_required) {
        // Enforce compulsory phone verification for first-time / unlinked users
        setPendingGoogleEmail(targetEmail);
        setPendingGoogleName(targetName);
        setPhone('');
        setOtp('');
        setViewMode('google_phone_link');
      }
    } catch (err: any) {
      setError(err.message || 'Google authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSendGooglePhoneOtp = async () => {
    const rawDigits = cleanPhoneInput(phone);
    if (rawDigits.length !== 10) {
      Alert.alert('Invalid Mobile', 'Please enter a valid 10-digit Indian mobile number');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const resp = await api.auth.sendOtp(`+91${rawDigits}`);
      setResendTimer(45);
      setOtp(''); // Strict security: user must type the code received via real SMS
      Alert.alert('OTP Dispatched', `A 6-digit verification code has been dispatched via SMS to +91 ${rawDigits}.`);
    } catch (err: any) {
      setError(err.message || 'Failed to dispatch SMS OTP. Please check gateway balance.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyGooglePhoneOtp = async () => {
    const rawDigits = cleanPhoneInput(phone);
    if (rawDigits.length !== 10) {
      Alert.alert('Invalid Mobile', 'Please enter your 10-digit mobile number');
      return;
    }
    if (!otp.trim() || otp.trim().length !== 6) {
      Alert.alert('Invalid OTP', 'Please enter the 6-digit verification code');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const resp = await api.auth.googleAuth({
        email: pendingGoogleEmail,
        full_name: pendingGoogleName,
        phone_number: `+91${rawDigits}`,
        otp: otp.trim(),
      });
      if (resp.tokens || resp.token) {
        // Successfully verified & linked! Remember this Google account
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem('ini_last_google_account', JSON.stringify({ email: pendingGoogleEmail, name: pendingGoogleName }));
        }
        const tokenData = resp.tokens || resp.token;
        setAuth(tokenData.user, tokenData.access_token);
        redirectByRole(tokenData.user.role);
      } else {
        setError('Verification succeeded but session token was missing. Please try again.');
      }
    } catch (err: any) {
      setError(err.message || 'OTP verification failed. Please check the code.');
    } finally {
      setLoading(false);
    }
  };

  // Find My Account Flow
  const handleFindAccount = async () => {
    if (!searchIdent) {
      Alert.alert('Missing Input', 'Please enter your mobile number or email');
      return;
    }
    setFindLoading(true);
    try {
      const res = await api.auth.findAccount(searchIdent);
      setFoundAccount(res);
    } catch (err: any) {
      Alert.alert('Search Error', err.message || 'Could not locate account');
    } finally {
      setFindLoading(false);
    }
  };

  // Responsive padding values based on device Safe Area
  const safePaddingTop = Math.max(insets.top, Platform.OS === 'android' ? 20 : 12);
  const safePaddingBottom = Math.max(insets.bottom, 16);
  const isSmallScreen = windowHeight < 720;

  return (
    <View style={styles.outerContainer}>
      <StatusBar style="dark" />

      {/* Main Responsive Mobile Container for ALL screens & markets */}
      <View
        style={[
          styles.responsiveAppWrapper,
          {
            paddingTop: safePaddingTop,
            paddingBottom: safePaddingBottom,
          },
        ]}
      >
        {/* Top Play Store Coming Soon Banner */}
        <View style={styles.topAnnouncementBar}>
          <TouchableOpacity
            style={styles.announcementPill}
            onPress={() => setPlayStoreModalVisible(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="logo-google-playstore" size={13} color="#059669" />
            <Text style={styles.announcementPillText} numberOfLines={1}>
              APK Coming Tomorrow on Play Store • Web Live Today
            </Text>
            <Ionicons name="chevron-forward" size={12} color="#059669" />
          </TouchableOpacity>
        </View>

        {/* ================= 1. WELCOME ONBOARDING SCREEN (Exact IndiRide Aesthetic) ================= */}
        {viewMode === 'welcome' && (
          <ScrollView
            contentContainerStyle={styles.welcomeScrollContent}
            bounces={false}
            showsVerticalScrollIndicator={false}
          >
            {/* Header Brand */}
            <View style={styles.welcomeBrandHeader}>
              <Text style={styles.welcomeBrandTitle}>
                <Text style={{ color: '#2563EB' }}>Indi</Text>
                <Text style={{ color: '#111827' }}>Ride</Text>
              </Text>
              <Text style={styles.welcomeTagline}>Bihar's Smart Ride-Hailing Network</Text>
            </View>

            {/* Center Hero Video (Plays login.mp4 in continuous loop) */}
            <View
              style={[
                styles.welcomeGraphicBox,
                { height: isSmallScreen ? 260 : Math.min(windowHeight * 0.42, 380) },
              ]}
            >
              <LoginHeroVideo style={styles.welcomeHeroImage} />
            </View>

            {/* Bottom Action Buttons */}
            <View style={styles.welcomeActionsBox}>
              <TouchableOpacity
                style={styles.primaryDarkBtn}
                onPress={() => {
                  setError('');
                  setViewMode('login');
                }}
                activeOpacity={0.88}
              >
                <Text style={styles.primaryDarkBtnText}>Log In</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryLightBtn}
                onPress={() => {
                  setError('');
                  setViewMode('signup');
                }}
                activeOpacity={0.88}
              >
                <Text style={styles.secondaryLightBtnText}>New to IndiRide? Sign Up</Text>
              </TouchableOpacity>

              {/* Driver Partner Switch Link */}
              <View style={styles.welcomeFooterLinks}>
                <TouchableOpacity
                  style={styles.subtleLink}
                  onPress={() => {
                    setRole(role === 'passenger' ? 'rider' : 'passenger');
                    setViewMode('login');
                  }}
                >
                  <MaterialCommunityIcons name="motorbike" size={15} color="#64748b" />
                  <Text style={styles.subtleLinkText}>
                    {role === 'passenger' ? 'Driver Partner Login' : 'Passenger Login'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        )}

        {/* ================= 2. LOG IN VIEW ================= */}
        {viewMode === 'login' && (
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.authViewContainer}
          >
            {/* Top Navigation */}
            <View style={styles.authTopNav}>
              <TouchableOpacity
                style={styles.backBtn}
                onPress={() => {
                  setError('');
                  setViewMode('welcome');
                }}
              >
                <Ionicons name="chevron-back" size={22} color="#0f172a" />
              </TouchableOpacity>
              <Text style={styles.authTopNavTitle}>Log In</Text>
              <View style={{ width: 36 }} />
            </View>

            <ScrollView contentContainerStyle={styles.authScrollContent} showsVerticalScrollIndicator={false}>
              <View style={styles.authHeaderBlock}>
                <Text style={styles.authTitle}>Welcome Back</Text>
                <Text style={styles.authSubtitle}>
                  Enter your mobile number to log in as{' '}
                  <Text style={{ fontWeight: '700', color: '#2563EB' }}>
                    {role === 'rider' ? 'Driver Partner' : 'Passenger'}
                  </Text>
                </Text>
              </View>

              {/* Mode Toggle Chip: Passenger vs Driver */}
              <View style={styles.roleToggleRow}>
                <TouchableOpacity
                  style={[styles.roleChip, role === 'passenger' && styles.roleChipActive]}
                  onPress={() => setRole('passenger')}
                >
                  <Ionicons
                    name="person"
                    size={14}
                    color={role === 'passenger' ? '#ffffff' : '#64748b'}
                  />
                  <Text style={[styles.roleChipText, role === 'passenger' && styles.roleChipTextActive]}>
                    Passenger
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.roleChip, role === 'rider' && styles.roleChipActive]}
                  onPress={() => setRole('rider')}
                >
                  <MaterialCommunityIcons
                    name="motorbike"
                    size={15}
                    color={role === 'rider' ? '#ffffff' : '#64748b'}
                  />
                  <Text style={[styles.roleChipText, role === 'rider' && styles.roleChipTextActive]}>
                    Driver Partner
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Error Message */}
              {error ? (
                <View style={styles.errorBanner}>
                  <Ionicons name="alert-circle" size={16} color="#dc2626" />
                  <Text style={styles.errorBannerText}>{error}</Text>
                </View>
              ) : null}

              {/* Phone Input */}
              <Text style={styles.inputFieldLabel}>Mobile Number</Text>
              <View style={styles.phoneInputRow}>
                <View style={styles.countryCodeBadge}>
                  <Text style={styles.countryCodeText}>🇮🇳 +91</Text>
                </View>
                <TextInput
                  style={styles.phoneInput}
                  placeholder="10-digit mobile number"
                  placeholderTextColor="#94a3b8"
                  keyboardType="phone-pad"
                  maxLength={10}
                  value={phone}
                  onChangeText={(t) => setPhone(cleanPhoneInput(t))}
                  autoFocus
                />
              </View>

              {/* Submit Button */}
              <TouchableOpacity
                style={styles.authSubmitBtn}
                onPress={() => handleSendOtp(false)}
                disabled={loading}
                activeOpacity={0.88}
              >
                {loading ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.authSubmitBtnText}>Get OTP</Text>
                )}
              </TouchableOpacity>

              {/* Secondary Options */}
              <View style={styles.quickOptionsRow}>
                <TouchableOpacity
                  style={styles.secondaryOptionBtn}
                  onPress={() => {
                    setGoogleComingSoonNotice(false);
                    setGoogleModalVisible(true);
                  }}
                >
                  <Ionicons name="logo-google" size={15} color="#ea4335" />
                  <Text style={styles.secondaryOptionBtnText}>Google</Text>
                  <View style={{ backgroundColor: '#fef3c7', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, marginLeft: 4 }}>
                    <Text style={{ fontSize: 9, color: '#b45309', fontWeight: '800' }}>SOON</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.secondaryOptionBtn}
                  onPress={() => {
                    setFindAccountModal(true);
                    setFoundAccount(null);
                  }}
                >
                  <Ionicons name="search" size={15} color="#0f172a" />
                  <Text style={styles.secondaryOptionBtnText}>Find Account</Text>
                </TouchableOpacity>
              </View>

              {/* Switch to Sign Up */}
              <View style={styles.switchAuthRow}>
                <Text style={styles.switchAuthText}>New to IndiRide?</Text>
                <TouchableOpacity
                  onPress={() => {
                    setError('');
                    setViewMode('signup');
                  }}
                >
                  <Text style={styles.switchAuthLink}>Create an Account</Text>
                </TouchableOpacity>
              </View>

              {/* Feature Testing & 1-Click Demo Accounts */}
              <View style={styles.tempDemoBox}>
                <View style={styles.tempDemoHeader}>
                  <Ionicons name="flask" size={13} color="#f59e0b" />
                  <Text style={styles.tempDemoTitle}>1-CLICK TEST ACCOUNTS (FEATURE TESTING)</Text>
                </View>
                <View style={styles.tempDemoPillsRow}>
                  <TouchableOpacity
                    style={styles.tempDemoPill}
                    onPress={() => handleDemoLogin('passenger')}
                    disabled={loading}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="person" size={12} color="#2563EB" />
                    <Text style={styles.tempDemoPillText}>Passenger</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.tempDemoPill, styles.tempDemoPillDriver]}
                    onPress={() => handleDemoLogin('rider1')}
                    disabled={loading}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="bicycle" size={13} color="#16a34a" />
                    <Text style={[styles.tempDemoPillText, { color: '#15803d' }]}>Driver 1 (Rajesh)</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.tempDemoPill, styles.tempDemoPillCampus]}
                    onPress={() => handleDemoLogin('rider2')}
                    disabled={loading}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="car" size={12} color="#059669" />
                    <Text style={[styles.tempDemoPillText, { color: '#047857' }]}>Driver 2 (Vikram)</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.tempDemoPill, styles.tempDemoPillAdmin]}
                    onPress={() => handleDemoLogin('admin')}
                    disabled={loading}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="shield" size={12} color="#7c3aed" />
                    <Text style={[styles.tempDemoPillText, { color: '#6d28d9' }]}>Admin</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        )}

        {/* ================= 3. SIGN UP VIEW ================= */}
        {viewMode === 'signup' && (
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.authViewContainer}
          >
            {/* Top Navigation */}
            <View style={styles.authTopNav}>
              <TouchableOpacity
                style={styles.backBtn}
                onPress={() => {
                  setError('');
                  setViewMode('welcome');
                }}
              >
                <Ionicons name="chevron-back" size={22} color="#0f172a" />
              </TouchableOpacity>
              <Text style={styles.authTopNavTitle}>Sign Up</Text>
              <View style={{ width: 36 }} />
            </View>

            <ScrollView contentContainerStyle={styles.authScrollContent} showsVerticalScrollIndicator={false}>
              <View style={styles.authHeaderBlock}>
                <Text style={styles.authTitle}>Create Account</Text>
                <Text style={styles.authSubtitle}>Sign up for instant rides & easy commute</Text>
              </View>

              {/* Mode Toggle */}
              <View style={styles.roleToggleRow}>
                <TouchableOpacity
                  style={[styles.roleChip, role === 'passenger' && styles.roleChipActive]}
                  onPress={() => setRole('passenger')}
                >
                  <Ionicons
                    name="person"
                    size={14}
                    color={role === 'passenger' ? '#ffffff' : '#64748b'}
                  />
                  <Text style={[styles.roleChipText, role === 'passenger' && styles.roleChipTextActive]}>
                    Passenger
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.roleChip, role === 'rider' && styles.roleChipActive]}
                  onPress={() => setRole('rider')}
                >
                  <MaterialCommunityIcons
                    name="motorbike"
                    size={15}
                    color={role === 'rider' ? '#ffffff' : '#64748b'}
                  />
                  <Text style={[styles.roleChipText, role === 'rider' && styles.roleChipTextActive]}>
                    Driver Partner
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Error Message */}
              {error ? (
                <View style={styles.errorBanner}>
                  <Ionicons name="alert-circle" size={16} color="#dc2626" />
                  <Text style={styles.errorBannerText}>{error}</Text>
                </View>
              ) : null}

              {/* Full Name */}
              <Text style={styles.inputFieldLabel}>Full Name *</Text>
              <View style={styles.textInputBox}>
                <Ionicons name="person-outline" size={16} color="#94a3b8" style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.textInputInside}
                  placeholder="Enter your name"
                  placeholderTextColor="#94a3b8"
                  value={fullName}
                  onChangeText={setFullName}
                />
              </View>

              {/* Mobile Number */}
              <Text style={styles.inputFieldLabel}>Mobile Number *</Text>
              <View style={styles.phoneInputRow}>
                <View style={styles.countryCodeBadge}>
                  <Text style={styles.countryCodeText}>🇮🇳 +91</Text>
                </View>
                <TextInput
                  style={styles.phoneInput}
                  placeholder="10-digit mobile number"
                  placeholderTextColor="#94a3b8"
                  keyboardType="phone-pad"
                  maxLength={10}
                  value={phone}
                  onChangeText={(t) => setPhone(cleanPhoneInput(t))}
                />
              </View>

              {/* Email (Optional) */}
              <Text style={styles.inputFieldLabel}>Email Address (Optional)</Text>
              <View style={styles.textInputBox}>
                <Ionicons name="mail-outline" size={16} color="#94a3b8" style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.textInputInside}
                  placeholder="e.g. name@example.com"
                  placeholderTextColor="#94a3b8"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={setEmail}
                />
              </View>

              {/* Driver Specific Fields */}
              {role === 'rider' && (
                <View style={styles.driverSectionBox}>
                  <Text style={styles.driverSectionTitle}>DRIVER SERVICE TYPE & SCOPE</Text>

                  {/* Rider Service Type Choice */}
                  <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
                    <TouchableOpacity
                      style={[
                        styles.roleChip,
                        { flex: 1, paddingVertical: 12, justifyContent: 'center' },
                        riderServiceType === 'REGULAR' && styles.roleChipActive,
                      ]}
                      onPress={() => setRiderServiceType('REGULAR')}
                    >
                      <MaterialCommunityIcons
                        name="taxi"
                        size={16}
                        color={riderServiceType === 'REGULAR' ? '#ffffff' : '#64748b'}
                      />
                      <Text style={[styles.roleChipText, riderServiceType === 'REGULAR' && styles.roleChipTextActive]}>
                        🚕 City Driver
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.roleChip,
                        { flex: 1, paddingVertical: 12, justifyContent: 'center' },
                        riderServiceType === 'CAMPUS' && styles.roleChipActive,
                      ]}
                      onPress={() => setRiderServiceType('CAMPUS')}
                    >
                      <Ionicons
                        name="school"
                        size={16}
                        color={riderServiceType === 'CAMPUS' ? '#ffffff' : '#64748b'}
                      />
                      <Text style={[styles.roleChipText, riderServiceType === 'CAMPUS' && styles.roleChipTextActive]}>
                        🎓 Campus Driver
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {riderServiceType === 'CAMPUS' ? (
                    <View style={{ marginBottom: 14, backgroundColor: '#f0fdf4', padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#bbf7d0' }}>
                      <Text style={[styles.inputFieldLabel, { color: '#166534', marginTop: 0 }]}>
                        Served Universities / Colleges *
                      </Text>
                      <View style={[styles.textInputBox, { backgroundColor: '#ffffff', borderColor: '#86efac' }]}>
                        <Ionicons name="business" size={16} color="#16a34a" style={{ marginRight: 8 }} />
                        <TextInput
                          style={styles.textInputInside}
                          placeholder="e.g. Parul University, MSU, Delhi University"
                          placeholderTextColor="#94a3b8"
                          value={servedUniversities}
                          onChangeText={setServedUniversities}
                        />
                      </View>
                      <Text style={{ fontSize: 11, color: '#15803d', marginTop: 4 }}>
                        💡 Multiple universities can be entered separated by comma (,). You will exclusively serve students commuting to/from these campuses.
                      </Text>
                    </View>
                  ) : (
                    <View style={{ marginBottom: 12, backgroundColor: '#f8fafc', padding: 8, borderRadius: 8 }}>
                      <Text style={{ fontSize: 11, color: '#64748b' }}>
                        🚕 Regular City Driver operates across all general city routes and airport corridors.
                      </Text>
                    </View>
                  )}

                  <Text style={styles.driverSectionTitle}>DRIVER VEHICLE & LICENSE DETAILS</Text>

                  <Text style={styles.inputFieldLabel}>Driving License *</Text>
                  <View style={styles.textInputBox}>
                    <TextInput
                      style={styles.textInputInside}
                      placeholder="e.g. DL-04-2024-001234"
                      placeholderTextColor="#94a3b8"
                      autoCapitalize="characters"
                      value={licenseNumber}
                      onChangeText={setLicenseNumber}
                    />
                  </View>

                  <Text style={styles.inputFieldLabel}>Vehicle Type / Tier *</Text>
                  <View style={styles.vehicleCategorySelector}>
                    {[
                      { id: 'bike', label: 'General Bike', desc: 'Splendor, Activa, Platina (₹7/km)', defaultModel: 'Hero Splendor Plus' },
                      { id: 'bullet', label: 'Pro Bike', desc: 'Royal Enfield Bullet, KTM, Hunter (₹13/km)', defaultModel: 'Royal Enfield Bullet 350' },
                      { id: 'auto', label: 'Auto Rickshaw', desc: 'Bajaj 3-Wheeler (₹10/km)', defaultModel: 'Bajaj RE Auto' },
                      { id: 'car', label: 'Car / Cab', desc: 'Swift Dzire, Sedan (₹15/km)', defaultModel: 'Maruti Dzire' },
                    ].map((item) => (
                      <TouchableOpacity
                        key={item.id}
                        style={[
                          styles.vehCategoryOption,
                          vehicleCategory === item.id && styles.vehCategoryOptionActive,
                        ]}
                        onPress={() => {
                          setVehicleCategory(item.id as any);
                          setVehicleModel(item.defaultModel);
                        }}
                      >
                        <View style={{ flex: 1 }}>
                          <Text
                            style={[
                              styles.vehCategoryTitle,
                              vehicleCategory === item.id && styles.vehCategoryTitleActive,
                            ]}
                          >
                            {item.label}
                          </Text>
                          <Text
                            style={[
                              styles.vehCategoryDesc,
                              vehicleCategory === item.id && styles.vehCategoryDescActive,
                            ]}
                          >
                            {item.desc}
                          </Text>
                        </View>
                        {vehicleCategory === item.id && (
                          <Ionicons name="checkmark-circle" size={18} color="#2563EB" />
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={styles.inputFieldLabel}>Vehicle Plate Number *</Text>
                  <View style={styles.textInputBox}>
                    <TextInput
                      style={styles.textInputInside}
                      placeholder="e.g. KA-01-EK-8892"
                      placeholderTextColor="#94a3b8"
                      autoCapitalize="characters"
                      value={vehiclePlate}
                      onChangeText={setVehiclePlate}
                    />
                  </View>

                  <Text style={styles.inputFieldLabel}>Vehicle Model / Make</Text>
                  <View style={styles.textInputBox}>
                    <TextInput
                      style={styles.textInputInside}
                      placeholder="e.g. Royal Enfield Bullet 350, Splendor"
                      placeholderTextColor="#94a3b8"
                      value={vehicleModel}
                      onChangeText={setVehicleModel}
                    />
                  </View>
                </View>
              )}

              {/* Submit Button */}
              <TouchableOpacity
                style={styles.authSubmitBtn}
                onPress={() => handleSendOtp(false)}
                disabled={loading}
                activeOpacity={0.88}
              >
                {loading ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.authSubmitBtnText}>Continue & Send OTP</Text>
                )}
              </TouchableOpacity>

              {/* Switch to Log In */}
              <View style={styles.switchAuthRow}>
                <Text style={styles.switchAuthText}>Already registered?</Text>
                <TouchableOpacity
                  onPress={() => {
                    setError('');
                    setViewMode('login');
                  }}
                >
                  <Text style={styles.switchAuthLink}>Log In Here</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        )}

        {/* ================= 4. OTP VERIFICATION VIEW ================= */}
        {viewMode === 'otp' && (
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.authViewContainer}
          >
            {/* Top Navigation */}
            <View style={styles.authTopNav}>
              <TouchableOpacity
                style={styles.backBtn}
                onPress={() => {
                  setError('');
                  setViewMode('login');
                }}
              >
                <Ionicons name="chevron-back" size={22} color="#0f172a" />
              </TouchableOpacity>
              <Text style={styles.authTopNavTitle}>Verify OTP</Text>
              <View style={{ width: 36 }} />
            </View>

            <ScrollView contentContainerStyle={styles.authScrollContent} showsVerticalScrollIndicator={false}>
              <View style={styles.otpShieldIconWrap}>
                <Ionicons name="shield-checkmark" size={36} color="#2563EB" />
              </View>

              <View style={styles.authHeaderBlockCenter}>
                <Text style={styles.authTitle}>Enter Verification Code</Text>
                <Text style={styles.authSubtitle}>
                  We sent a 6-digit OTP code to{' '}
                  <Text style={{ fontWeight: '800', color: '#0f172a' }}>+91 {cleanPhoneInput(phone)}</Text>
                </Text>
              </View>

              {/* Error Message */}
              {error ? (
                <View style={styles.errorBanner}>
                  <Ionicons name="alert-circle" size={16} color="#dc2626" />
                  <Text style={styles.errorBannerText}>{error}</Text>
                </View>
              ) : null}

              {/* Large OTP Box */}
              <TextInput
                style={styles.largeOtpInput}
                placeholder="••••••"
                placeholderTextColor="#cbd5e1"
                keyboardType="number-pad"
                maxLength={6}
                value={otp}
                onChangeText={setOtp}
                autoFocus
              />

              {/* Verify Button */}
              <TouchableOpacity
                style={styles.authSubmitBtn}
                onPress={handleVerifyOtp}
                disabled={loading}
                activeOpacity={0.88}
              >
                {loading ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.authSubmitBtnText}>Verify & Proceed</Text>
                )}
              </TouchableOpacity>

              {/* Resend & Change Phone Controls */}
              <View style={styles.otpControlsBox}>
                {resendTimer > 0 ? (
                  <View style={styles.timerChip}>
                    <Ionicons name="time-outline" size={14} color="#64748b" />
                    <Text style={styles.timerChipText}>
                      Resend OTP in 0:{resendTimer < 10 ? `0${resendTimer}` : resendTimer}
                    </Text>
                  </View>
                ) : resendCount < MAX_RESENDS ? (
                  <TouchableOpacity
                    style={styles.resendActiveBtn}
                    onPress={() => handleSendOtp(true)}
                    disabled={loading}
                  >
                    <Ionicons name="refresh" size={15} color="#2563EB" />
                    <Text style={styles.resendActiveBtnText}>
                      Resend OTP {resendCount > 0 ? `(${resendCount}/${MAX_RESENDS})` : ''}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={styles.maxResendWarningText}>
                    Maximum 5 resend requests reached. Try again later.
                  </Text>
                )}

                <TouchableOpacity
                  style={styles.changeMobileBtn}
                  onPress={() => {
                    setOtp('');
                    setError('');
                    setViewMode('login');
                  }}
                >
                  <Ionicons name="create-outline" size={14} color="#64748b" />
                  <Text style={styles.changeMobileBtnText}>Change Mobile Number</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        )}

        {/* ================= 5. NAME & PROFILE SETUP VIEW (POST-OTP) ================= */}
        {viewMode === 'name_entry' && (
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.authViewContainer}
          >
            {/* Top Navigation */}
            <View style={styles.authTopNav}>
              <TouchableOpacity
                style={styles.backBtn}
                onPress={() => {
                  setError('');
                  setViewMode('login');
                }}
              >
                <Ionicons name="chevron-back" size={22} color="#0f172a" />
              </TouchableOpacity>
              <Text style={styles.authTopNavTitle}>Profile Setup</Text>
              <View style={{ width: 36 }} />
            </View>

            <ScrollView contentContainerStyle={styles.authScrollContent} showsVerticalScrollIndicator={false}>
              <View style={styles.authHeaderBlock}>
                <Text style={styles.authTitle}>
                  {role === 'rider' ? 'Driver Registration & KYC 📋' : "What's your name? 👋"}
                </Text>
                <Text style={styles.authSubtitle}>
                  {role === 'rider'
                    ? 'Login safal raha! Ride accept karne ke liye kripya apni details, Driving License aur Aadhaar Card documents submit karein.'
                    : 'Please enter your real full name so your ride partners know who you are.'}
                </Text>
              </View>

              {/* Account Role Selector */}
              <View style={styles.roleToggleRow}>
                <TouchableOpacity
                  style={[styles.roleChip, role === 'passenger' && styles.roleChipActive]}
                  onPress={() => setRole('passenger')}
                >
                  <Ionicons
                    name="person"
                    size={14}
                    color={role === 'passenger' ? '#ffffff' : '#64748b'}
                  />
                  <Text style={[styles.roleChipText, role === 'passenger' && styles.roleChipTextActive]}>
                    Passenger
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.roleChip, role === 'rider' && styles.roleChipActive]}
                  onPress={() => setRole('rider')}
                >
                  <MaterialCommunityIcons
                    name="motorbike"
                    size={15}
                    color={role === 'rider' ? '#ffffff' : '#64748b'}
                  />
                  <Text style={[styles.roleChipText, role === 'rider' && styles.roleChipTextActive]}>
                    Driver Partner
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Error Message */}
              {error ? (
                <View style={styles.errorBanner}>
                  <Ionicons name="alert-circle" size={16} color="#dc2626" />
                  <Text style={styles.errorBannerText}>{error}</Text>
                </View>
              ) : null}

              {/* Full Name Input */}
              <Text style={styles.inputFieldLabel}>YOUR FULL NAME *</Text>
              <View style={styles.textInputBox}>
                <Ionicons name="person-outline" size={16} color="#94a3b8" style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.textInputInside}
                  placeholder="e.g. Rahul Sharma"
                  placeholderTextColor="#94a3b8"
                  value={fullName}
                  onChangeText={setFullName}
                  autoFocus
                />
              </View>

              {/* Mobile Number Input */}
              <Text style={styles.inputFieldLabel}>MOBILE NUMBER *</Text>
              <View style={styles.phoneInputRow}>
                <View style={styles.countryCodeBadge}>
                  <Text style={styles.countryCodeText}>🇮🇳 +91</Text>
                </View>
                <TextInput
                  style={styles.phoneInput}
                  placeholder="10-digit mobile number"
                  placeholderTextColor="#94a3b8"
                  keyboardType="phone-pad"
                  maxLength={10}
                  value={cleanPhoneInput(phone)}
                  onChangeText={(t) => setPhone(cleanPhoneInput(t))}
                />
              </View>

              {/* Optional Email */}
              <Text style={styles.inputFieldLabel}>EMAIL ADDRESS (OPTIONAL)</Text>
              <View style={styles.textInputBox}>
                <Ionicons name="mail-outline" size={16} color="#94a3b8" style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.textInputInside}
                  placeholder="e.g. rahul@gmail.com"
                  placeholderTextColor="#94a3b8"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={setEmail}
                />
              </View>

              {/* Driver partner registration options if driver selected */}
              {role === 'rider' && (
                <View style={styles.driverSectionBox}>
                  <Text style={styles.driverSectionTitle}>CHOOSE DRIVER REGISTRATION TYPE</Text>
                  
                  {/* 2 Options: Campus Registration vs Permanent Registration */}
                  <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
                    <TouchableOpacity
                      style={[
                        {
                          flex: 1,
                          padding: 12,
                          borderRadius: 14,
                          borderWidth: 2,
                          borderColor: riderServiceType === 'CAMPUS' ? '#10b981' : '#e2e8f0',
                          backgroundColor: riderServiceType === 'CAMPUS' ? '#f0fdf4' : '#ffffff',
                          alignItems: 'center',
                        },
                      ]}
                      onPress={() => setRiderServiceType('CAMPUS')}
                      activeOpacity={0.8}
                    >
                      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: riderServiceType === 'CAMPUS' ? '#10b981' : '#f1f5f9', alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
                        <Ionicons name="school" size={20} color={riderServiceType === 'CAMPUS' ? '#ffffff' : '#64748b'} />
                      </View>
                      <Text style={{ fontSize: 13, fontWeight: '800', color: riderServiceType === 'CAMPUS' ? '#065f46' : '#0f172a', textAlign: 'center' }}>
                        Campus Reg
                      </Text>
                      <Text style={{ fontSize: 10, color: '#047857', fontWeight: '700', marginTop: 4, backgroundColor: '#dcfce7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                        ⚡ Instant Approval
                      </Text>
                      <Text style={{ fontSize: 10, color: '#64748b', textAlign: 'center', marginTop: 4 }}>
                        For Students & College Staff
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        {
                          flex: 1,
                          padding: 12,
                          borderRadius: 14,
                          borderWidth: 2,
                          borderColor: riderServiceType === 'REGULAR' ? '#2563EB' : '#e2e8f0',
                          backgroundColor: riderServiceType === 'REGULAR' ? '#eff6ff' : '#ffffff',
                          alignItems: 'center',
                        },
                      ]}
                      onPress={() => setRiderServiceType('REGULAR')}
                      activeOpacity={0.8}
                    >
                      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: riderServiceType === 'REGULAR' ? '#2563EB' : '#f1f5f9', alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
                        <Ionicons name="car" size={20} color={riderServiceType === 'REGULAR' ? '#ffffff' : '#64748b'} />
                      </View>
                      <Text style={{ fontSize: 13, fontWeight: '800', color: riderServiceType === 'REGULAR' ? '#1e40af' : '#0f172a', textAlign: 'center' }}>
                        Permanent Reg
                      </Text>
                      <Text style={{ fontSize: 10, color: '#1d4ed8', fontWeight: '700', marginTop: 4, backgroundColor: '#dbeafe', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                        📋 Admin Janch
                      </Text>
                      <Text style={{ fontSize: 10, color: '#64748b', textAlign: 'center', marginTop: 4 }}>
                        Commercial Taxi & Auto
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* CAMPUS REGISTRATION FORM */}
                  {riderServiceType === 'CAMPUS' ? (
                    <View>
                      <View style={{ backgroundColor: '#ecfdf5', borderRadius: 10, padding: 10, marginBottom: 14, borderWidth: 1, borderColor: '#a7f3d0', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Ionicons name="flash" size={18} color="#059669" />
                        <Text style={{ fontSize: 11, color: '#065f46', fontWeight: '600', flex: 1 }}>
                          Zero Admin Wait! Campus drivers are auto-approved instantly with Student ID and Aadhaar Card.
                        </Text>
                      </View>

                      <Text style={styles.inputFieldLabel}>College / University Name *</Text>
                      <View style={styles.textInputBox}>
                        <Ionicons name="business-outline" size={16} color="#059669" style={{ marginRight: 8 }} />
                        <TextInput
                          style={styles.textInputInside}
                          placeholder="e.g. Parul University, Vadodara"
                          placeholderTextColor="#94a3b8"
                          value={collegeName}
                          onChangeText={setCollegeName}
                        />
                      </View>

                      <Text style={styles.inputFieldLabel}>Academic Year / Validity *</Text>
                      <View style={styles.textInputBox}>
                        <Ionicons name="calendar-outline" size={16} color="#059669" style={{ marginRight: 8 }} />
                        <TextInput
                          style={styles.textInputInside}
                          placeholder="e.g. Final Year (2024-2025) / 3rd Year"
                          placeholderTextColor="#94a3b8"
                          value={academicYear}
                          onChangeText={setAcademicYear}
                        />
                      </View>

                      <Text style={styles.inputFieldLabel}>Vehicle Type / Tier *</Text>
                      <View style={styles.vehicleCategorySelector}>
                        {[
                          { id: 'bike', label: 'Bike / Scooter', desc: 'Splendor, Activa, Platina', defaultModel: 'Hero Splendor Plus' },
                          { id: 'bullet', label: 'Pro Bike', desc: 'Bullet, Duke, Hunter', defaultModel: 'Royal Enfield Bullet 350' },
                          { id: 'auto', label: 'Auto Rickshaw', desc: 'Bajaj 3-Wheeler', defaultModel: 'Bajaj RE Auto' },
                          { id: 'car', label: 'Car / Cab', desc: 'Swift Dzire, Sedan', defaultModel: 'Maruti Dzire' },
                        ].map((item) => (
                          <TouchableOpacity
                            key={item.id}
                            style={[
                              styles.vehCategoryOption,
                              vehicleCategory === item.id && styles.vehCategoryOptionActive,
                            ]}
                            onPress={() => {
                              setVehicleCategory(item.id as any);
                              setVehicleModel(item.defaultModel);
                            }}
                          >
                            <View style={{ flex: 1 }}>
                              <Text
                                style={[
                                  styles.vehCategoryTitle,
                                  vehicleCategory === item.id && styles.vehCategoryTitleActive,
                                ]}
                              >
                                {item.label}
                              </Text>
                              <Text
                                style={[
                                  styles.vehCategoryDesc,
                                  vehicleCategory === item.id && styles.vehCategoryDescActive,
                                ]}
                              >
                                {item.desc}
                              </Text>
                            </View>
                            {vehicleCategory === item.id && (
                              <Ionicons name="checkmark-circle" size={18} color="#2563EB" />
                            )}
                          </TouchableOpacity>
                        ))}
                      </View>

                      <Text style={styles.inputFieldLabel}>Vehicle / Gadi Number *</Text>
                      <View style={styles.textInputBox}>
                        <Ionicons name="speedometer-outline" size={16} color="#059669" style={{ marginRight: 8 }} />
                        <TextInput
                          style={styles.textInputInside}
                          placeholder="e.g. GJ-06-AB-1234"
                          placeholderTextColor="#94a3b8"
                          autoCapitalize="characters"
                          value={vehiclePlate}
                          onChangeText={setVehiclePlate}
                        />
                      </View>

                      <Text style={styles.inputFieldLabel}>Student ID Card Number *</Text>
                      <View style={styles.textInputBox}>
                        <Ionicons name="id-card-outline" size={16} color="#059669" style={{ marginRight: 8 }} />
                        <TextInput
                          style={styles.textInputInside}
                          placeholder="e.g. PU-2022-CSE-8941"
                          placeholderTextColor="#94a3b8"
                          autoCapitalize="characters"
                          value={studentIdNumber}
                          onChangeText={setStudentIdNumber}
                        />
                      </View>

                      <Text style={styles.inputFieldLabel}>Upload Student ID Card Photo *</Text>
                      <View style={styles.docUploadCard}>
                        {studentIdPhoto ? (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                            <Image source={{ uri: studentIdPhoto }} style={styles.licensePreviewThumb} />
                            <View style={{ flex: 1 }}>
                              <Text style={styles.docUploadedTitle}>✅ Student ID Card Uploaded</Text>
                              <TouchableOpacity onPress={() => handlePickDocument('student_id')}>
                                <Text style={styles.docChangeText}>Change Photo</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        ) : (
                          <View>
                            <TouchableOpacity
                              style={styles.docUploadBtn}
                              onPress={() => handlePickDocument('student_id')}
                              activeOpacity={0.8}
                            >
                              <Ionicons name="school-outline" size={22} color="#059669" />
                              <Text style={[styles.docUploadBtnText, { color: '#059669' }]}>Upload Student ID (Front Photo)</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={{
                                marginTop: 6,
                                alignSelf: 'center',
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 4,
                                paddingVertical: 4,
                                paddingHorizontal: 8,
                                backgroundColor: '#f0fdf4',
                                borderRadius: 6,
                                borderWidth: 1,
                                borderColor: '#bbf7d0',
                              }}
                              onPress={() =>
                                setStudentIdPhoto('https://images.unsplash.com/photo-1544717305-2782549b5136?w=400')
                              }
                            >
                              <Ionicons name="sparkles" size={12} color="#16a34a" />
                              <Text style={{ fontSize: 11, fontWeight: '700', color: '#16a34a' }}>
                                Use Sample Student ID
                              </Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>

                      <Text style={styles.inputFieldLabel}>Aadhaar Card Number (12 Digits) *</Text>
                      <View style={styles.textInputBox}>
                        <Ionicons name="finger-print-outline" size={16} color="#0284c7" style={{ marginRight: 8 }} />
                        <TextInput
                          style={styles.textInputInside}
                          placeholder="e.g. 5432 8901 2345"
                          placeholderTextColor="#94a3b8"
                          keyboardType="number-pad"
                          maxLength={14}
                          value={aadhaarNumber}
                          onChangeText={(t) => {
                            const clean = t.replace(/\D/g, '').slice(0, 12);
                            const formatted = clean.replace(/(\d{4})(?=\d)/g, '$1 ');
                            setAadhaarNumber(formatted);
                          }}
                        />
                      </View>

                      <Text style={styles.inputFieldLabel}>Upload Aadhaar Card (Front Photo) *</Text>
                      <View style={styles.docUploadCard}>
                        {aadhaarPhoto ? (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                            <Image source={{ uri: aadhaarPhoto }} style={styles.licensePreviewThumb} />
                            <View style={{ flex: 1 }}>
                              <Text style={styles.docUploadedTitle}>✅ Aadhaar Card Uploaded</Text>
                              <TouchableOpacity onPress={() => handlePickDocument('aadhaar')}>
                                <Text style={styles.docChangeText}>Change Photo</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        ) : (
                          <View>
                            <TouchableOpacity
                              style={styles.docUploadBtn}
                              onPress={() => handlePickDocument('aadhaar')}
                              activeOpacity={0.8}
                            >
                              <Ionicons name="finger-print-outline" size={22} color="#0284c7" />
                              <Text style={styles.docUploadBtnText}>Upload Aadhaar Document</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={{
                                marginTop: 6,
                                alignSelf: 'center',
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 4,
                                paddingVertical: 4,
                                paddingHorizontal: 8,
                                backgroundColor: '#f0fdf4',
                                borderRadius: 6,
                                borderWidth: 1,
                                borderColor: '#bbf7d0',
                              }}
                              onPress={() =>
                                setAadhaarPhoto('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=300')
                              }
                            >
                              <Ionicons name="sparkles" size={12} color="#16a34a" />
                              <Text style={{ fontSize: 11, fontWeight: '700', color: '#16a34a' }}>
                                Use Sample Aadhaar Document
                              </Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    </View>
                  ) : (
                    /* PERMANENT DRIVER REGISTRATION FORM */
                    <View>
                      <View style={{ backgroundColor: '#eff6ff', borderRadius: 10, padding: 10, marginBottom: 14, borderWidth: 1, borderColor: '#bfdbfe', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Ionicons name="shield-checkmark" size={18} color="#2563EB" />
                        <Text style={{ fontSize: 11, color: '#1e40af', fontWeight: '600', flex: 1 }}>
                          Admin Janch Required: Permanent commercial drivers are verified by admin before taking regular trips.
                        </Text>
                      </View>

                      <Text style={styles.inputFieldLabel}>Driving License Number *</Text>
                      <View style={styles.textInputBox}>
                        <Ionicons name="card-outline" size={16} color="#64748b" style={{ marginRight: 8 }} />
                        <TextInput
                          style={styles.textInputInside}
                          placeholder="e.g. DL-04-2024-001234"
                          placeholderTextColor="#94a3b8"
                          autoCapitalize="characters"
                          value={licenseNumber}
                          onChangeText={setLicenseNumber}
                        />
                      </View>

                      <Text style={styles.inputFieldLabel}>Aadhaar Card Number (12 Digits) *</Text>
                      <View style={styles.textInputBox}>
                        <Ionicons name="finger-print-outline" size={16} color="#0284c7" style={{ marginRight: 8 }} />
                        <TextInput
                          style={styles.textInputInside}
                          placeholder="e.g. 5432 8901 2345"
                          placeholderTextColor="#94a3b8"
                          keyboardType="number-pad"
                          maxLength={14}
                          value={aadhaarNumber}
                          onChangeText={(t) => {
                            const clean = t.replace(/\D/g, '').slice(0, 12);
                            const formatted = clean.replace(/(\d{4})(?=\d)/g, '$1 ');
                            setAadhaarNumber(formatted);
                          }}
                        />
                      </View>

                      <Text style={styles.inputFieldLabel}>Vehicle Type / Tier *</Text>
                      <View style={styles.vehicleCategorySelector}>
                        {[
                          { id: 'bike', label: 'General Bike', desc: 'Splendor, Activa, Platina (₹7/km)', defaultModel: 'Hero Splendor Plus' },
                          { id: 'bullet', label: 'Pro Bike', desc: 'Bullet, KTM Duke, Hunter (₹13/km)', defaultModel: 'Royal Enfield Bullet 350' },
                          { id: 'auto', label: 'Auto Rickshaw', desc: 'Bajaj 3-Wheeler (₹10/km)', defaultModel: 'Bajaj RE Auto' },
                          { id: 'car', label: 'Car / Cab', desc: 'Swift Dzire, Sedan (₹15/km)', defaultModel: 'Maruti Dzire' },
                        ].map((item) => (
                          <TouchableOpacity
                            key={item.id}
                            style={[
                              styles.vehCategoryOption,
                              vehicleCategory === item.id && styles.vehCategoryOptionActive,
                            ]}
                            onPress={() => {
                              setVehicleCategory(item.id as any);
                              setVehicleModel(item.defaultModel);
                            }}
                          >
                            <View style={{ flex: 1 }}>
                              <Text
                                style={[
                                  styles.vehCategoryTitle,
                                  vehicleCategory === item.id && styles.vehCategoryTitleActive,
                                ]}
                              >
                                {item.label}
                              </Text>
                              <Text
                                style={[
                                  styles.vehCategoryDesc,
                                  vehicleCategory === item.id && styles.vehCategoryDescActive,
                                ]}
                              >
                                {item.desc}
                              </Text>
                            </View>
                            {vehicleCategory === item.id && (
                              <Ionicons name="checkmark-circle" size={18} color="#2563EB" />
                            )}
                          </TouchableOpacity>
                        ))}
                      </View>

                      <Text style={styles.inputFieldLabel}>Vehicle Plate Number *</Text>
                      <View style={styles.textInputBox}>
                        <TextInput
                          style={styles.textInputInside}
                          placeholder="e.g. KA-01-EK-8892"
                          placeholderTextColor="#94a3b8"
                          autoCapitalize="characters"
                          value={vehiclePlate}
                          onChangeText={setVehiclePlate}
                        />
                      </View>

                      <Text style={styles.inputFieldLabel}>Permanent Address *</Text>
                      <View style={[styles.textInputBox, { height: 64, alignItems: 'flex-start', paddingTop: 8 }]}>
                        <TextInput
                          style={[styles.textInputInside, { height: 48 }]}
                          placeholder="e.g. Village/Town, Tehsil, District, State, PIN Code"
                          placeholderTextColor="#94a3b8"
                          multiline
                          value={permanentAddress}
                          onChangeText={setPermanentAddress}
                        />
                      </View>

                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, marginBottom: 4 }}>
                        <Text style={styles.inputFieldLabel}>Current / Operating Address *</Text>
                        <TouchableOpacity
                          style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
                          onPress={() => {
                            const next = !sameAddress;
                            setSameAddress(next);
                            if (next) setCurrentAddress(permanentAddress);
                          }}
                        >
                          <Ionicons
                            name={sameAddress ? 'checkbox' : 'square-outline'}
                            size={16}
                            color={sameAddress ? '#2563EB' : '#94a3b8'}
                          />
                          <Text style={{ fontSize: 12, color: '#2563EB', fontWeight: '700' }}>Same as Permanent</Text>
                        </TouchableOpacity>
                      </View>
                      {!sameAddress && (
                        <View style={[styles.textInputBox, { height: 64, alignItems: 'flex-start', paddingTop: 8 }]}>
                          <TextInput
                            style={[styles.textInputInside, { height: 48 }]}
                            placeholder="e.g. Current Room / Hostel / City Address"
                            placeholderTextColor="#94a3b8"
                            multiline
                            value={currentAddress}
                            onChangeText={setCurrentAddress}
                          />
                        </View>
                      )}

                      <Text style={styles.inputFieldLabel}>Passport Size Photo *</Text>
                      <View style={styles.docUploadCard}>
                        {passportPhoto ? (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                            <Image source={{ uri: passportPhoto }} style={styles.docPreviewThumb} />
                            <View style={{ flex: 1 }}>
                              <Text style={styles.docUploadedTitle}>✅ Passport Photo Uploaded</Text>
                              <TouchableOpacity onPress={() => handlePickDocument('passport')}>
                                <Text style={styles.docChangeText}>Change Photo</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        ) : (
                          <View>
                            <TouchableOpacity
                              style={styles.docUploadBtn}
                              onPress={() => handlePickDocument('passport')}
                              activeOpacity={0.8}
                            >
                              <Ionicons name="camera-outline" size={22} color="#2563EB" />
                              <Text style={styles.docUploadBtnText}>Upload Passport Photo (Selfie / Formal)</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={{
                                marginTop: 6,
                                alignSelf: 'center',
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 4,
                                paddingVertical: 4,
                                paddingHorizontal: 8,
                                backgroundColor: '#f0fdf4',
                                borderRadius: 6,
                                borderWidth: 1,
                                borderColor: '#bbf7d0',
                              }}
                              onPress={() =>
                                setPassportPhoto('https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300')
                              }
                            >
                              <Ionicons name="sparkles" size={12} color="#16a34a" />
                              <Text style={{ fontSize: 11, fontWeight: '700', color: '#16a34a' }}>
                                Use Sample Passport Photo
                              </Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>

                      <Text style={styles.inputFieldLabel}>Driving License Document Photo *</Text>
                      <View style={styles.docUploadCard}>
                        {licensePhoto ? (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                            <Image source={{ uri: licensePhoto }} style={styles.licensePreviewThumb} />
                            <View style={{ flex: 1 }}>
                              <Text style={styles.docUploadedTitle}>✅ Driving License Uploaded</Text>
                              <TouchableOpacity onPress={() => handlePickDocument('license')}>
                                <Text style={styles.docChangeText}>Change Document</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        ) : (
                          <View>
                            <TouchableOpacity
                              style={styles.docUploadBtn}
                              onPress={() => handlePickDocument('license')}
                              activeOpacity={0.8}
                            >
                              <Ionicons name="card-outline" size={22} color="#2563EB" />
                              <Text style={styles.docUploadBtnText}>Upload Driving License (Front View)</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={{
                                marginTop: 6,
                                alignSelf: 'center',
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 4,
                                paddingVertical: 4,
                                paddingHorizontal: 8,
                                backgroundColor: '#f0fdf4',
                                borderRadius: 6,
                                borderWidth: 1,
                                borderColor: '#bbf7d0',
                              }}
                              onPress={() =>
                                setLicensePhoto('https://images.unsplash.com/photo-1578632767115-351597cf2477?w=300')
                              }
                            >
                              <Ionicons name="sparkles" size={12} color="#16a34a" />
                              <Text style={{ fontSize: 11, fontWeight: '700', color: '#16a34a' }}>
                                Use Sample License Document
                              </Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>

                      <Text style={styles.inputFieldLabel}>Upload Aadhaar Card (Front / Document Photo) *</Text>
                      <View style={styles.docUploadCard}>
                        {aadhaarPhoto ? (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                            <Image source={{ uri: aadhaarPhoto }} style={styles.licensePreviewThumb} />
                            <View style={{ flex: 1 }}>
                              <Text style={styles.docUploadedTitle}>✅ Aadhaar Card Document Uploaded</Text>
                              <TouchableOpacity onPress={() => handlePickDocument('aadhaar')}>
                                <Text style={styles.docChangeText}>Change Document</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        ) : (
                          <View>
                            <TouchableOpacity
                              style={styles.docUploadBtn}
                              onPress={() => handlePickDocument('aadhaar')}
                              activeOpacity={0.8}
                            >
                              <Ionicons name="finger-print-outline" size={22} color="#0284c7" />
                              <Text style={styles.docUploadBtnText}>Upload Aadhaar Card Document</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={{
                                marginTop: 6,
                                alignSelf: 'center',
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 4,
                                paddingVertical: 4,
                                paddingHorizontal: 8,
                                backgroundColor: '#f0fdf4',
                                borderRadius: 6,
                                borderWidth: 1,
                                borderColor: '#bbf7d0',
                              }}
                              onPress={() =>
                                setAadhaarPhoto('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=300')
                              }
                            >
                              <Ionicons name="sparkles" size={12} color="#16a34a" />
                              <Text style={{ fontSize: 11, fontWeight: '700', color: '#16a34a' }}>
                                Use Sample Aadhaar Document
                              </Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    </View>
                  )}
                </View>
              )}

              {/* Complete & Submit Button */}
              <TouchableOpacity
                style={[
                  styles.authSubmitBtn,
                  role === 'rider' && riderServiceType === 'CAMPUS' && { backgroundColor: '#059669' }
                ]}
                onPress={handleCompleteNameEntry}
                disabled={loading}
                activeOpacity={0.88}
              >
                {loading ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.authSubmitBtnText}>
                    {role === 'rider'
                      ? (riderServiceType === 'CAMPUS'
                          ? '⚡ Complete Campus Registration & Start Immediately'
                          : 'Submit Driver Application for Approval 📋')
                      : 'Save Name & Start Riding 🚀'}
                  </Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        )}

        {/* ================= 6. GOOGLE COMPULSORY PHONE LINKING VIEW ================= */}
        {viewMode === 'google_phone_link' && (
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.authViewContainer}
          >
            <View style={styles.authTopNav}>
              <TouchableOpacity
                style={styles.backBtn}
                onPress={() => {
                  setError('');
                  setViewMode('login');
                }}
              >
                <Ionicons name="chevron-back" size={22} color="#0f172a" />
              </TouchableOpacity>
              <Text style={styles.authTopNavTitle}>Mandatory Phone Verification</Text>
              <View style={{ width: 36 }} />
            </View>

            <ScrollView contentContainerStyle={styles.authScrollContent} showsVerticalScrollIndicator={false}>
              {/* Google Verified Card */}
              <View style={styles.googleVerifiedCard}>
                <Ionicons name="logo-google" size={20} color="#ea4335" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.googleVerifiedTitle}>Google Account Connected</Text>
                  <Text style={styles.googleVerifiedEmail}>{pendingGoogleEmail}</Text>
                </View>
                <Ionicons name="checkmark-circle" size={22} color="#16a34a" />
              </View>

              <View style={styles.authHeaderBlock}>
                <Text style={styles.authTitle}>Link Mobile Number 📱</Text>
                <Text style={styles.authSubtitle}>
                  In accordance with Indian transport safety guidelines, every passenger must verify an active Indian mobile number (+91) before booking rides.
                </Text>
              </View>

              {error ? (
                <View style={styles.errorBanner}>
                  <Ionicons name="alert-circle" size={16} color="#ef4444" />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              {/* Phone Input Box */}
              <Text style={styles.inputFieldLabel}>Indian Mobile Number (+91)</Text>
              <View style={styles.phoneInputRow}>
                <View style={styles.countryCodeBadge}>
                  <Text style={styles.countryCodeText}>🇮🇳 +91</Text>
                </View>
                <TextInput
                  style={styles.phoneTextInput}
                  placeholder="Enter 10-digit number"
                  placeholderTextColor="#94a3b8"
                  keyboardType="number-pad"
                  maxLength={10}
                  value={phone}
                  onChangeText={(val) => setPhone(cleanPhoneInput(val))}
                />
              </View>

              {/* Send OTP button */}
              <TouchableOpacity
                style={[styles.authSubmitBtn, { marginTop: 12, backgroundColor: '#0284c7' }]}
                onPress={handleSendGooglePhoneOtp}
                disabled={loading || phone.length !== 10}
                activeOpacity={0.88}
              >
                {loading && resendTimer === 0 ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.authSubmitBtnText}>
                    {resendTimer > 0 ? `Resend OTP in ${resendTimer}s` : 'Send Real SMS OTP 📩'}
                  </Text>
                )}
              </TouchableOpacity>

              {/* 6-Digit OTP Box */}
              <View style={{ marginTop: 20 }}>
                <Text style={styles.inputFieldLabel}>Enter 6-Digit Verification Code</Text>
                <View style={styles.textInputBox}>
                  <TextInput
                    style={[styles.textInputInside, { letterSpacing: 8, fontSize: 18, fontWeight: '700' }]}
                    placeholder="• • • • • •"
                    placeholderTextColor="#94a3b8"
                    keyboardType="number-pad"
                    maxLength={6}
                    value={otp}
                    onChangeText={setOtp}
                  />
                </View>
              </View>

              {/* Complete Verification Button */}
              <TouchableOpacity
                style={[
                  styles.authSubmitBtn,
                  { marginTop: 16, backgroundColor: otp.length === 6 ? '#059669' : '#94a3b8' }
                ]}
                onPress={handleVerifyGooglePhoneOtp}
                disabled={loading || otp.length !== 6}
                activeOpacity={0.88}
              >
                {loading && resendTimer > 0 ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.authSubmitBtnText}>Verify & Start IndiRide 🚀</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        )}
      </View>

      {/* Google Modal */}
      <Modal visible={googleModalVisible} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="logo-google" size={18} color="#ea4335" />
                <Text style={styles.modalCardTitle}>Sign in with Google</Text>
                <View style={{ backgroundColor: '#fef3c7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: '#fde68a' }}>
                  <Text style={{ fontSize: 10, fontWeight: '800', color: '#b45309' }}>COMING SOON</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setGoogleModalVisible(false)}>
                <Ionicons name="close" size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalCardSub}>Enter your Gmail address to request verification OTP:</Text>

            <Text style={styles.inputFieldLabel}>Gmail Address</Text>
            <View style={styles.textInputBox}>
              <Ionicons name="mail-outline" size={18} color="#64748b" style={{ marginRight: 8 }} />
              <TextInput
                style={styles.textInputInside}
                placeholder="yourname@gmail.com"
                keyboardType="email-address"
                autoCapitalize="none"
                value={googleEmailInput}
                onChangeText={(t) => {
                  setGoogleEmailInput(t);
                  setGoogleComingSoonNotice(false);
                }}
              />
            </View>

            {googleComingSoonNotice ? (
              <View style={{
                backgroundColor: '#fffbeb',
                borderColor: '#f59e0b',
                borderWidth: 1.5,
                borderRadius: 12,
                padding: 14,
                marginTop: 14,
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <Ionicons name="lock-closed" size={16} color="#d97706" />
                  <Text style={{ fontSize: 13, fontWeight: '800', color: '#92400e' }}>
                    Feature Locked • Coming Soon 🚀
                  </Text>
                </View>
                <Text style={{ fontSize: 12, color: '#78350f', lineHeight: 18 }}>
                  Gmail OTP verification is currently locked for upcoming security release. Please use 100% verified Mobile Number OTP to access your account today!
                </Text>
                <TouchableOpacity
                  style={{
                    backgroundColor: '#10b981',
                    borderRadius: 8,
                    paddingVertical: 10,
                    alignItems: 'center',
                    marginTop: 12,
                  }}
                  onPress={() => {
                    setGoogleModalVisible(false);
                    setGoogleComingSoonNotice(false);
                  }}
                >
                  <Text style={{ color: '#ffffff', fontWeight: '800', fontSize: 13 }}>Continue with Mobile Number OTP ➔</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.authSubmitBtn, { marginTop: 14, backgroundColor: '#0284c7' }]}
                onPress={() => {
                  const email = googleEmailInput.trim().toLowerCase();
                  if (!email || !email.includes('@')) {
                    Alert.alert('Invalid Gmail', 'Please enter a valid Gmail address (e.g. name@gmail.com)');
                    return;
                  }
                  setGoogleComingSoonNotice(true);
                  Alert.alert(
                    'Feature Locked • Coming Soon 🚀',
                    'Gmail OTP verification is currently locked for upcoming security release. Please use Mobile Number OTP to log in today!'
                  );
                }}
              >
                <Ionicons name="shield-checkmark-outline" size={17} color="#ffffff" style={{ marginRight: 6 }} />
                <Text style={styles.authSubmitBtnText}>Verify Gmail</Text>
              </TouchableOpacity>
            )}

            <Text style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center', marginTop: 14 }}>
              🔒 Note: For guaranteed rider &amp; passenger safety, direct mobile SMS OTP is the primary verified login method.
            </Text>
          </View>
        </View>
      </Modal>

      {/* Find My Account Modal */}
      <Modal visible={findAccountModal} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="search" size={18} color="#0f172a" />
                <Text style={styles.modalCardTitle}>Find My Account</Text>
              </View>
              <TouchableOpacity onPress={() => setFindAccountModal(false)}>
                <Ionicons name="close" size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalCardSub}>Enter your phone or email to locate your account:</Text>

            <View style={styles.textInputBox}>
              <TextInput
                style={styles.textInputInside}
                placeholder="10-digit mobile or email"
                placeholderTextColor="#94a3b8"
                value={searchIdent}
                onChangeText={setSearchIdent}
              />
            </View>

            <TouchableOpacity
              style={[styles.authSubmitBtn, { marginTop: 12 }]}
              onPress={handleFindAccount}
              disabled={findLoading}
            >
              {findLoading ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.authSubmitBtnText}>Search</Text>}
            </TouchableOpacity>

            {foundAccount && (
              <View style={styles.foundAccountCard}>
                {foundAccount.found ? (
                  <>
                    <Text style={styles.foundAccountName}>{foundAccount.full_name}</Text>
                    <Text style={styles.foundAccountMeta}>Phone: {foundAccount.masked_phone}</Text>
                    <Text style={styles.foundAccountRole}>Role: {foundAccount.role?.toUpperCase()}</Text>
                    <TouchableOpacity
                      style={[styles.authSubmitBtn, { marginTop: 8, paddingVertical: 10 }]}
                      onPress={() => {
                        const raw = foundAccount.raw_phone ? foundAccount.raw_phone.replace('+91', '') : '';
                        setPhone(raw);
                        setFindAccountModal(false);
                        setViewMode('login');
                      }}
                    >
                      <Text style={styles.authSubmitBtnText}>Log In with This Account</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <Text style={{ color: '#dc2626', fontSize: 13, textAlign: 'center' }}>
                    {foundAccount.message || 'No account found with this identifier'}
                  </Text>
                )}
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Founder Story Modal */}
      <FounderStoryModal
        visible={founderModalVisible}
        onClose={() => setFounderModalVisible(false)}
      />

      {/* Play Store Coming Soon Modal */}
      <PlayStoreComingSoonModal
        visible={playStoreModalVisible}
        onClose={() => setPlayStoreModalVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create<any>({
  outerContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
    width: '100%',
    height: '100%',
  },
  responsiveAppWrapper: {
    width: '100%',
    maxWidth: Platform.OS === 'web' && typeof window !== 'undefined' && window.innerWidth > 600 ? 460 : '100%',
    alignSelf: 'center',
    flex: 1,
    backgroundColor: '#ffffff',
    display: 'flex',
    flexDirection: 'column',
  },
  topAnnouncementBar: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 6,
    gap: 6,
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  announcementPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
  },
  announcementPillText: {
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
    color: '#065f46',
  },
  founderMiniPill: {
    alignSelf: 'flex-start',
    backgroundColor: '#f0f9ff',
    borderWidth: 1,
    borderColor: '#bae6fd',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  founderMiniPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0369a1',
    letterSpacing: 0.2,
  },
  googleVerifiedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 12,
    gap: 10,
    marginBottom: 16,
  },
  googleVerifiedTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
  },
  googleVerifiedEmail: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },
  // Welcome View Styles
  welcomeScrollContent: {
    flexGrow: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  welcomeBrandHeader: {
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 4,
  },
  welcomeBrandTitle: {
    fontSize: 42,
    fontWeight: '900',
    letterSpacing: -1,
  },
  welcomeTagline: {
    fontSize: 15,
    color: '#475569',
    fontWeight: '500',
    marginTop: 4,
  },
  welcomeGraphicBox: {
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
    overflow: 'hidden',
    marginVertical: 12,
  },
  welcomeHeroImage: {
    width: '100%',
    height: '100%',
  },
  welcomeActionsBox: {
    width: '100%',
    gap: 12,
    paddingTop: 8,
  },
  primaryDarkBtn: {
    backgroundColor: '#1E2530',
    borderRadius: 16,
    paddingVertical: 17,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 8px rgba(30, 37, 48, 0.2)',
    elevation: 3,
  },
  primaryDarkBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  secondaryLightBtn: {
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 16,
    paddingVertical: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryLightBtnText: {
    color: '#1E2530',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  welcomeFooterLinks: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 6,
    paddingHorizontal: 6,
  },
  subtleLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
  },
  subtleLinkText: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
  },
  // Auth Form Common Views
  authViewContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  authTopNav: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  authTopNavTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  authScrollContent: {
    padding: 24,
    paddingBottom: 40,
  },
  authHeaderBlock: {
    marginBottom: 20,
  },
  authHeaderBlockCenter: {
    alignItems: 'center',
    marginBottom: 20,
  },
  authTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: -0.5,
  },
  authSubtitle: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 6,
    lineHeight: 20,
  },
  roleToggleRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 18,
  },
  roleChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  roleChipActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  roleChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  roleChipTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  riderQuickTestingCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    marginBottom: 14,
  },
  riderQuickTestingTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 0.5,
  },
  demoBadgePill: {
    backgroundColor: '#dbeafe',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  demoBadgePillText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#1d4ed8',
  },
  demoDriverActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    borderRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: 8,
  },
  demoDriverActionBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#065f46',
  },
  tempDemoBox: {
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  tempDemoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 8,
  },
  tempDemoTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 0.8,
  },
  tempDemoPillsRow: {
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  tempDemoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 20,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  tempDemoPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1d4ed8',
  },
  tempDemoPillDriver: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
  },
  tempDemoPillCampus: {
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
  },
  tempDemoPillPending: {
    backgroundColor: '#fff7ed',
    borderColor: '#fed7aa',
  },
  tempDemoPillAdmin: {
    backgroundColor: '#f5f3ff',
    borderColor: '#ddd6fe',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  errorBannerText: {
    color: '#dc2626',
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  inputFieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  phoneInputRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 18,
  },
  countryCodeBadge: {
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    paddingHorizontal: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  countryCodeText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  phoneInput: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
    letterSpacing: 0.5,
    outlineStyle: 'none' as any,
  },
  textInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  textInputInside: {
    flex: 1,
    height: '100%',
    paddingVertical: 14,
    fontSize: 15,
    color: '#0f172a',
    outlineStyle: 'none' as any,
    borderWidth: 0,
    backgroundColor: 'transparent',
  },
  authSubmitBtn: {
    backgroundColor: '#1E2530',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    boxShadow: '0 4px 8px rgba(30, 37, 48, 0.2)',
  },
  authSubmitBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  quickOptionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 18,
  },
  secondaryOptionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingVertical: 12,
  },
  secondaryOptionBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  switchAuthRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 24,
  },
  switchAuthText: {
    fontSize: 14,
    color: '#64748b',
  },
  switchAuthLink: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2563EB',
  },
  driverSectionBox: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  driverSectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#2563EB',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  vehicleCategorySelector: {
    gap: 8,
    marginBottom: 16,
  },
  vehCategoryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
  },
  vehCategoryOptionActive: {
    backgroundColor: '#eff6ff',
    borderColor: '#2563EB',
  },
  vehCategoryTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  vehCategoryTitleActive: {
    color: '#1d4ed8',
  },
  vehCategoryDesc: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  vehCategoryDescActive: {
    color: '#2563EB',
  },
  // OTP Verification View Styles
  otpShieldIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 16,
  },
  largeOtpInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 2,
    borderColor: '#cbd5e1',
    borderRadius: 16,
    fontSize: 28,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 12,
    paddingVertical: 16,
    color: '#0f172a',
    marginVertical: 16,
    outlineStyle: 'none' as any,
  },
  otpControlsBox: {
    alignItems: 'center',
    marginTop: 20,
    gap: 12,
  },
  timerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timerChipText: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
  },
  resendActiveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#eff6ff',
  },
  resendActiveBtnText: {
    color: '#2563EB',
    fontSize: 13,
    fontWeight: '700',
  },
  maxResendWarningText: {
    fontSize: 12,
    color: '#d97706',
    fontWeight: '600',
    textAlign: 'center',
  },
  changeMobileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 6,
  },
  changeMobileBtnText: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
  },
  // Modal Backdrop & Card
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  modalCardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  modalCardSub: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 12,
  },
  foundAccountCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginTop: 12,
  },
  foundAccountName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  foundAccountMeta: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  foundAccountRole: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563EB',
    marginTop: 4,
  },
  otpNoticeCard: {
    backgroundColor: '#eff6ff',
    borderWidth: 1.5,
    borderColor: '#bfdbfe',
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  otpNoticeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  otpNoticeHeaderTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1d4ed8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  otpNoticeCodeDisplay: {
    fontSize: 28,
    fontWeight: '900',
    color: '#1e3a8a',
    letterSpacing: 6,
    marginVertical: 4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  otpNoticeAutoFillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#dbeafe',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    marginTop: 4,
    marginBottom: 6,
  },
  otpNoticeAutoFillText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1d4ed8',
  },
  otpNoticeFootnote: {
    fontSize: 11,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 15,
  },
  docUploadCard: {
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  docUploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
  },
  docUploadBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2563EB',
  },
  docPreviewThumb: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#cbd5e1',
  },
  licensePreviewThumb: {
    width: 100,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#cbd5e1',
  },
  docUploadedTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#059669',
  },
  docChangeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2563EB',
    marginTop: 3,
  },
});
