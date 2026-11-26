import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  Platform,
  useWindowDimensions,
  Animated,
  Linking,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

interface AIVoiceCallVerificationModalProps {
  visible: boolean;
  driverName: string;
  universityName: string;
  cityName: string;
  stateName?: string;
  onOption1Confirmed: () => void;
  onOption2EditRequested: () => void;
  onOption3SupportRequested: () => void;
  onClose: () => void;
}

export const AIVoiceCallVerificationModal: React.FC<AIVoiceCallVerificationModalProps> = ({
  visible,
  driverName,
  universityName,
  cityName,
  stateName,
  onOption1Confirmed,
  onOption2EditRequested,
  onOption3SupportRequested,
  onClose,
}) => {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  // Call States: 'incoming' | 'connected' | 'ended'
  const [callState, setCallState] = useState<'incoming' | 'connected' | 'ended'>('incoming');
  const [callSeconds, setCallSeconds] = useState<number>(0);
  const [selectedDigit, setSelectedDigit] = useState<string | null>(null);
  const [aiSpeechText, setAiSpeechText] = useState<string>('');
  const [isAiSpeaking, setIsAiSpeaking] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('');

  // Animation values
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const waveAnim1 = useRef(new Animated.Value(0.4)).current;
  const waveAnim2 = useRef(new Animated.Value(0.8)).current;
  const waveAnim3 = useRef(new Animated.Value(0.3)).current;

  // Audio Context Ref for synthetic ring
  const ringAudioCtxRef = useRef<any>(null);
  const ringIntervalRef = useRef<any>(null);

  // Pulse animation for avatar
  useEffect(() => {
    if (!visible) return;

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.15,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();

    return () => pulse.stop();
  }, [visible, pulseAnim]);

  // Wave visualizer loop
  useEffect(() => {
    if (callState !== 'connected') return;

    const wave = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(waveAnim1, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(waveAnim1, { toValue: 0.3, duration: 400, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(waveAnim2, { toValue: 0.3, duration: 500, useNativeDriver: true }),
          Animated.timing(waveAnim2, { toValue: 1, duration: 500, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(waveAnim3, { toValue: 0.9, duration: 350, useNativeDriver: true }),
          Animated.timing(waveAnim3, { toValue: 0.4, duration: 350, useNativeDriver: true }),
        ]),
      ])
    );
    wave.start();

    return () => wave.stop();
  }, [callState, waveAnim1, waveAnim2, waveAnim3]);

  // Synthetic telephone ring generator using Web Audio API
  const startSyntheticRing = () => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      ringAudioCtxRef.current = ctx;

      const playBeep = () => {
        if (!ringAudioCtxRef.current || ringAudioCtxRef.current.state === 'closed') return;
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gainNode = ctx.createGain();

        osc1.frequency.value = 440; // US / Indian standard dual tone
        osc2.frequency.value = 480;

        osc1.type = 'sine';
        osc2.type = 'sine';

        gainNode.gain.setValueAtTime(0.08, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);

        osc1.connect(gainNode);
        osc2.connect(gainNode);
        gainNode.connect(ctx.destination);

        osc1.start();
        osc2.start();
        osc1.stop(ctx.currentTime + 1.2);
        osc2.stop(ctx.currentTime + 1.2);
      };

      playBeep();
      ringIntervalRef.current = setInterval(playBeep, 3000);
    } catch {
      // Audio autoplay restrictions fallback gracefully
    }
  };

  const stopSyntheticRing = () => {
    if (ringIntervalRef.current) {
      clearInterval(ringIntervalRef.current);
      ringIntervalRef.current = null;
    }
    if (ringAudioCtxRef.current) {
      try {
        ringAudioCtxRef.current.close();
      } catch {}
      ringAudioCtxRef.current = null;
    }
  };

  // Web Speech Synthesis
  const speakText = (text: string, onEnd?: () => void) => {
    setAiSpeechText(text);
    setIsAiSpeaking(true);

    if (Platform.OS === 'web' && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.95;
      utterance.pitch = 1.05;

      // Try selecting a Hindi or Indian English voice
      const voices = window.speechSynthesis.getVoices();
      const indianVoice = voices.find(
        (v) =>
          v.lang.includes('hi') ||
          v.lang.includes('IN') ||
          v.name.toLowerCase().includes('india') ||
          v.name.toLowerCase().includes('hindi')
      );
      if (indianVoice) {
        utterance.voice = indianVoice;
      }

      utterance.onend = () => {
        setIsAiSpeaking(false);
        if (onEnd) onEnd();
      };
      utterance.onerror = () => {
        setIsAiSpeaking(false);
        if (onEnd) onEnd();
      };

      window.speechSynthesis.speak(utterance);
    } else {
      // Non-web fallback timer
      setTimeout(() => {
        setIsAiSpeaking(false);
        if (onEnd) onEnd();
      }, 5000);
    }
  };

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setCallState('incoming');
      setCallSeconds(0);
      setSelectedDigit(null);
      setStatusMessage('');
      startSyntheticRing();
    } else {
      stopSyntheticRing();
      if (Platform.OS === 'web' && typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    }

    return () => {
      stopSyntheticRing();
      if (Platform.OS === 'web' && typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [visible]);

  // Call timer effect
  useEffect(() => {
    let timer: any = null;
    if (callState === 'connected') {
      timer = setInterval(() => {
        setCallSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [callState]);

  // Format seconds to mm:ss
  const formatCallDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // 1. User Answers Call
  const handleAnswerCall = () => {
    stopSyntheticRing();
    setCallState('connected');

    const primaryUni = universityName.split(',')[0].trim() || 'Gujarat Campus Hub';
    const cleanCity = cityName || 'Aapke Area';
    const promptMessage = `Namaste ${driverName || 'Partner'} ji! IndiRide Compliance Officer bol rahi hoon. Humne aapka driver partner registration praapt kiya hai. Aapne ${primaryUni}, ${cleanCity} ke liye apply kiya hai. Kya aap is location par permanent rehte hain? Kripya dial pad par: 1 dabayein confirm karne ke liye. 2 dabayein University ya City badalne ke liye. Ya 3 dabayein hamare customer support executive se baat karne ke liye.`;

    speakText(promptMessage);
  };

  // 2. User Declines Call
  const handleDeclineCall = () => {
    stopSyntheticRing();
    if (Platform.OS === 'web' && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setCallState('ended');
    setTimeout(() => {
      onClose();
    }, 600);
  };

  // 3. User Presses DTMF Keypad (1, 2, or 3)
  const handleKeyPress = (digit: string) => {
    setSelectedDigit(digit);

    if (digit === '1') {
      setStatusMessage('✅ Location Successfully Confirmed & Verified!');
      const confirmSpeech = `Dhanyawaad ${driverName || 'Partner'} ji! Aapki location successfully confirm ho gayi hai. Aapka application final review ke liye jama kar diya gaya hai aur 7 dino ke andar approve ho jayega. IndiRide ke sath judne ke liye shukriya!`;
      speakText(confirmSpeech, () => {
        setTimeout(() => {
          onOption1Confirmed();
        }, 800);
      });
    } else if (digit === '2') {
      setStatusMessage('🔄 Redirecting to change University / City...');
      const editSpeech = `Theek hai! Hum aapko registration form par wapas le chal rahe hain taaki aap apni University ya City badal sakein.`;
      speakText(editSpeech, () => {
        setTimeout(() => {
          onOption2EditRequested();
        }, 800);
      });
    } else if (digit === '3') {
      setStatusMessage('📞 Connecting to IndiRide Customer Support Desk...');
      const supportSpeech = `Aapki call hamare customer support desk ko transfer ki ja rahi hai. Kripya bane rahein.`;
      speakText(supportSpeech, () => {
        setTimeout(() => {
          onOption3SupportRequested();
        }, 1200);
      });
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.phoneFrameContainer}>
          {/* Header Bar */}
          <View style={styles.phoneTopBar}>
            <View style={styles.shieldBadge}>
              <Ionicons name="shield-checkmark" size={13} color="#22c55e" />
              <Text style={styles.shieldBadgeText}>INDIRIDE AGENTIC AI VERIFICATION</Text>
            </View>
            <TouchableOpacity onPress={handleDeclineCall} style={styles.topCloseBtn}>
              <Ionicons name="close" size={20} color="#94a3b8" />
            </TouchableOpacity>
          </View>

          {/* Caller Profile Section */}
          <View style={styles.callerProfileWrap}>
            <Animated.View style={[styles.avatarGlowRing, { transform: [{ scale: pulseAnim }] }]}>
              <View style={styles.avatarCircle}>
                <MaterialCommunityIcons name="robot" size={44} color="#38bdf8" />
              </View>
            </Animated.View>

            <Text style={styles.callerName}>IndiRide AI Verification Officer</Text>
            <Text style={styles.callerNumber}>+91 (800) INDIRIDE-AI • Verified</Text>

            {/* Status text */}
            <View style={styles.callStatusBadge}>
              {callState === 'incoming' && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={styles.ringingDot} />
                  <Text style={styles.callStatusText}>Incoming Verification Call...</Text>
                </View>
              )}
              {callState === 'connected' && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={styles.connectedDot} />
                  <Text style={[styles.callStatusText, { color: '#4ade80' }]}>
                    Call Connected ({formatCallDuration(callSeconds)})
                  </Text>
                </View>
              )}
              {callState === 'ended' && (
                <Text style={[styles.callStatusText, { color: '#ef4444' }]}>Call Ended</Text>
              )}
            </View>
          </View>

          {/* Connected Call Content */}
          {callState === 'connected' && (
            <View style={styles.activeCallBody}>
              {/* Audio Wave Visualizer */}
              <View style={styles.audioWaveContainer}>
                <Animated.View
                  style={[
                    styles.audioWaveBar,
                    { transform: [{ scaleY: isAiSpeaking ? waveAnim1 : 0.3 }] },
                  ]}
                />
                <Animated.View
                  style={[
                    styles.audioWaveBar,
                    { transform: [{ scaleY: isAiSpeaking ? waveAnim2 : 0.3 }], height: 32 },
                  ]}
                />
                <Animated.View
                  style={[
                    styles.audioWaveBar,
                    { transform: [{ scaleY: isAiSpeaking ? waveAnim3 : 0.3 }], height: 26 },
                  ]}
                />
                <Animated.View
                  style={[
                    styles.audioWaveBar,
                    { transform: [{ scaleY: isAiSpeaking ? waveAnim1 : 0.3 }], height: 38 },
                  ]}
                />
                <Animated.View
                  style={[
                    styles.audioWaveBar,
                    { transform: [{ scaleY: isAiSpeaking ? waveAnim2 : 0.3 }], height: 22 },
                  ]}
                />
              </View>

              {/* Live Speech Subtitle Card */}
              <View style={styles.speechSubtitleCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <Ionicons name="volume-high" size={15} color="#38bdf8" />
                  <Text style={styles.speechSubtitleHeader}>AI ASSISTANT IS SPEAKING (HINDI / HINGLISH):</Text>
                </View>
                <Text style={styles.speechSubtitleText}>
                  {aiSpeechText || 'Connecting to IndiRide Voice Engine...'}
                </Text>
              </View>

              {statusMessage ? (
                <View style={styles.statusNotificationBanner}>
                  <Text style={styles.statusNotificationText}>{statusMessage}</Text>
                </View>
              ) : null}

              {/* Interactive DTMF Keypad Options */}
              <Text style={styles.keypadInstructionsTitle}>PRESS DIAL PAD BUTTON TO RESPOND:</Text>
              <View style={styles.dtmfButtonsGrid}>
                {/* Button 1 */}
                <TouchableOpacity
                  style={[
                    styles.dtmfOptionCard,
                    selectedDigit === '1' && styles.dtmfOptionCardSelected,
                  ]}
                  onPress={() => handleKeyPress('1')}
                  activeOpacity={0.8}
                >
                  <View style={[styles.dtmfDigitBadge, selectedDigit === '1' && { backgroundColor: '#16a34a' }]}>
                    <Text style={styles.dtmfDigitText}>1</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.dtmfOptionTitle}>Haan, Main Yahin Permanent Rehta Hoon</Text>
                    <Text style={styles.dtmfOptionDesc}>Confirm Location ({universityName.split(',')[0].trim() || cityName})</Text>
                  </View>
                  <Ionicons name="checkmark-circle" size={20} color={selectedDigit === '1' ? '#4ade80' : '#475569'} />
                </TouchableOpacity>

                {/* Button 2 */}
                <TouchableOpacity
                  style={[
                    styles.dtmfOptionCard,
                    selectedDigit === '2' && styles.dtmfOptionCardSelected,
                  ]}
                  onPress={() => handleKeyPress('2')}
                  activeOpacity={0.8}
                >
                  <View style={[styles.dtmfDigitBadge, selectedDigit === '2' && { backgroundColor: '#d97706' }]}>
                    <Text style={styles.dtmfDigitText}>2</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.dtmfOptionTitle}>University / City Change Karna Hai</Text>
                    <Text style={styles.dtmfOptionDesc}>Modify Operating Campuses &amp; Routes</Text>
                  </View>
                  <Ionicons name="repeat" size={20} color={selectedDigit === '2' ? '#fbbf24' : '#475569'} />
                </TouchableOpacity>

                {/* Button 3 */}
                <TouchableOpacity
                  style={[
                    styles.dtmfOptionCard,
                    selectedDigit === '3' && styles.dtmfOptionCardSelected,
                  ]}
                  onPress={() => handleKeyPress('3')}
                  activeOpacity={0.8}
                >
                  <View style={[styles.dtmfDigitBadge, selectedDigit === '3' && { backgroundColor: '#0284c7' }]}>
                    <Text style={styles.dtmfDigitText}>3</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.dtmfOptionTitle}>Customer Care Support Se Baat Karein</Text>
                    <Text style={styles.dtmfOptionDesc}>Talk to IndiRide Officer (+91-Support)</Text>
                  </View>
                  <Ionicons name="headset" size={20} color={selectedDigit === '3' ? '#38bdf8' : '#475569'} />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Incoming Call Action Controls */}
          {callState === 'incoming' && (
            <View style={styles.incomingActionsBox}>
              <Text style={styles.incomingPromptText}>
                IndiRide verification officer is verifying your submitted university &amp; KYC details.
              </Text>
              <View style={styles.callActionRow}>
                {/* Decline */}
                <TouchableOpacity
                  style={[styles.callBtnCircle, { backgroundColor: '#dc2626' }]}
                  onPress={handleDeclineCall}
                  activeOpacity={0.8}
                >
                  <Ionicons name="call" size={28} color="#ffffff" style={{ transform: [{ rotate: '135deg' }] }} />
                  <Text style={styles.callBtnLabel}>Decline</Text>
                </TouchableOpacity>

                {/* Accept */}
                <TouchableOpacity
                  style={[styles.callBtnCircle, { backgroundColor: '#16a34a' }]}
                  onPress={handleAnswerCall}
                  activeOpacity={0.8}
                >
                  <Ionicons name="call" size={28} color="#ffffff" />
                  <Text style={styles.callBtnLabel}>Answer 📞</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* End Call Button for Connected State */}
          {callState === 'connected' && (
            <View style={styles.endCallFooter}>
              <TouchableOpacity
                style={styles.endCallBtnCircle}
                onPress={handleDeclineCall}
                activeOpacity={0.8}
              >
                <Ionicons name="call" size={24} color="#ffffff" style={{ transform: [{ rotate: '135deg' }] }} />
              </TouchableOpacity>
              <Text style={styles.endCallFooterLabel}>End Call</Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.94)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  phoneFrameContainer: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#0f172a',
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: '#334155',
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 20,
  },
  phoneTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  shieldBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#052e16',
    borderColor: '#166534',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  shieldBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#4ade80',
    letterSpacing: 0.5,
  },
  topCloseBtn: {
    padding: 4,
  },
  callerProfileWrap: {
    alignItems: 'center',
    marginVertical: 10,
  },
  avatarGlowRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#1e293b',
    borderWidth: 2,
    borderColor: '#38bdf8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  callerName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#f8fafc',
    textAlign: 'center',
    marginBottom: 2,
  },
  callerNumber: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 8,
  },
  callStatusBadge: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  ringingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#38bdf8',
  },
  connectedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4ade80',
  },
  callStatusText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#38bdf8',
  },
  activeCallBody: {
    marginTop: 10,
  },
  audioWaveContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    height: 44,
    marginVertical: 8,
  },
  audioWaveBar: {
    width: 6,
    height: 36,
    borderRadius: 3,
    backgroundColor: '#38bdf8',
  },
  speechSubtitleCard: {
    backgroundColor: '#1e293b',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 12,
    marginBottom: 12,
  },
  speechSubtitleHeader: {
    fontSize: 10,
    fontWeight: '800',
    color: '#38bdf8',
    letterSpacing: 0.5,
  },
  speechSubtitleText: {
    fontSize: 13,
    color: '#e2e8f0',
    lineHeight: 18,
    fontWeight: '500',
  },
  statusNotificationBanner: {
    backgroundColor: '#064e3b',
    borderColor: '#059669',
    borderWidth: 1,
    borderRadius: 10,
    padding: 8,
    marginBottom: 10,
  },
  statusNotificationText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6ee7b7',
    textAlign: 'center',
  },
  keypadInstructionsTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94a3b8',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  dtmfButtonsGrid: {
    gap: 8,
    marginBottom: 10,
  },
  dtmfOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderWidth: 1.5,
    borderColor: '#334155',
    borderRadius: 14,
    padding: 10,
    gap: 10,
  },
  dtmfOptionCardSelected: {
    borderColor: '#38bdf8',
    backgroundColor: '#0c4a6e',
  },
  dtmfDigitBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dtmfDigitText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#ffffff',
  },
  dtmfOptionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#f8fafc',
  },
  dtmfOptionDesc: {
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 1,
  },
  incomingActionsBox: {
    marginTop: 20,
    alignItems: 'center',
  },
  incomingPromptText: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 24,
    paddingHorizontal: 10,
  },
  callActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    paddingHorizontal: 20,
  },
  callBtnCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  callBtnLabel: {
    position: 'absolute',
    bottom: -22,
    fontSize: 11,
    fontWeight: '800',
    color: '#f1f5f9',
  },
  endCallFooter: {
    alignItems: 'center',
    marginTop: 14,
  },
  endCallBtnCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#dc2626',
    justifyContent: 'center',
    alignItems: 'center',
  },
  endCallFooterLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
    marginTop: 6,
  },
});
