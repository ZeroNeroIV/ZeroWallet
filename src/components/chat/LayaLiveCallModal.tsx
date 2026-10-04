/**
 * LayaLiveCallModal — Immersive Live Voice Call Interface
 *
 * Full-screen architectural HUD for bidirectional real-time audio interaction with LAYA.
 * Features animated reactive soundwaves, live transcription stream, audio spectrum visualizer,
 * and quick-action financial chips.
 */

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  SafeAreaView,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { useThemeColors } from '../../hooks/useThemeColors';
import { lightHaptic, mediumHaptic, heavyHaptic } from '../../services/haptics/hapticFeedback';
import type { LayaVoiceService } from '../../services/ai/harness/voice/layaVoiceService';
import type { VoiceCallStatus, LiveTranscriptLine } from '../../services/ai/harness/types';

const AnimatedView = Animated.View as React.ComponentType<any>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface LayaLiveCallModalProps {
  visible: boolean;
  voiceService: LayaVoiceService | null;
  onClose: () => void;
  onWidgetGenerated?: (widget: any) => void;
}

const QUICK_VOICE_CHIPS = [
  'What is my current balance?',
  'Spent 15 on lunch',
  'What is my runway and financial health?',
  'Monthly spending breakdown',
  'What subscriptions do I have?',
];

export const LayaLiveCallModal: React.FC<LayaLiveCallModalProps> = ({
  visible,
  voiceService,
  onClose,
  onWidgetGenerated,
}) => {
  const themeColors = useThemeColors();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);

  const [callStatus, setCallStatus] = useState<VoiceCallStatus>('connecting');
  const [transcript, setTranscript] = useState<LiveTranscriptLine[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [frequencyBands, setFrequencyBands] = useState<number[]>([0.2, 0.4, 0.6, 0.4, 0.2]);

  // Animated values for central sound orb
  const pulseScale = useSharedValue(1);
  const ringScale1 = useSharedValue(1);
  const ringScale2 = useSharedValue(1);
  const ringOpacity1 = useSharedValue(0.6);
  const ringOpacity2 = useSharedValue(0.3);

  // Subscribe to voice service events
  useEffect(() => {
    if (!voiceService || !visible) return;

    const unsubStatus = voiceService.addStatusListener((status) => {
      setCallStatus(status);
      setIsMuted(voiceService.isMute());
    });

    const unsubTranscript = voiceService.addTranscriptListener((lines) => {
      setTranscript(lines);
    });

    const unsubAudio = voiceService.addAudioLevelListener((level, bands) => {
      setFrequencyBands(bands);
      // Animate pulsing scale based on voice intensity
      pulseScale.value = withTiming(1 + level * 0.35, { duration: 80 });
    });

    return () => {
      unsubStatus();
      unsubTranscript();
      unsubAudio();
    };
  }, [voiceService, visible, pulseScale]);

  // Ambient pulsing rings loop
  useEffect(() => {
    if (!visible) return;

    ringScale1.value = withRepeat(
      withSequence(
        withTiming(1.4, { duration: 1800, easing: Easing.out(Easing.ease) }),
        withTiming(1, { duration: 1800, easing: Easing.in(Easing.ease) })
      ),
      -1,
      true
    );

    ringScale2.value = withRepeat(
      withSequence(
        withTiming(1.8, { duration: 2400, easing: Easing.out(Easing.ease) }),
        withTiming(1, { duration: 2400, easing: Easing.in(Easing.ease) })
      ),
      -1,
      true
    );
  }, [visible, ringScale1, ringScale2]);

  const orbAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  const ring1AnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ringScale1.value }],
    opacity: ringOpacity1.value,
  }));

  const ring2AnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ringScale2.value }],
    opacity: ringOpacity2.value,
  }));

  const handleToggleMute = useCallback(() => {
    if (!voiceService) return;
    mediumHaptic();
    const muted = voiceService.toggleMute();
    setIsMuted(muted);
  }, [voiceService]);

  const handleToggleSpeaker = useCallback(() => {
    if (!voiceService) return;
    lightHaptic();
    const speaker = voiceService.toggleSpeaker();
    setIsSpeakerOn(speaker);
  }, [voiceService]);

  const handleHangUp = useCallback(() => {
    heavyHaptic();
    voiceService?.endCall();
    onClose();
  }, [voiceService, onClose]);

  const handleChipPress = useCallback(
    async (text: string) => {
      if (!voiceService) return;
      lightHaptic();
      try {
        const res = await voiceService.sendVoicePrompt(text);
        if (res.widgets && res.widgets.length > 0 && onWidgetGenerated) {
          res.widgets.forEach((w) => onWidgetGenerated(w));
        }
      } catch (e) {
        console.error('[LayaLiveCallModal] Chip trigger error:', e);
      }
    },
    [voiceService, onWidgetGenerated]
  );

  const statusLabel = useMemo(() => {
    switch (callStatus) {
      case 'connecting':
        return 'CONNECTING TO LAYA...';
      case 'connected':
        return 'LAYA LIVE · ONLINE';
      case 'listening':
        return 'LISTENING TO YOUR VOICE...';
      case 'thinking':
        return 'ANALYZING FINANCIAL LEDGER...';
      case 'speaking':
        return 'LAYA IS SPEAKING';
      case 'muted':
        return 'MICROPHONE MUTED';
      default:
        return 'OFFLINE';
    }
  }, [callStatus]);

  const latestTranscript = transcript.length > 0 ? transcript[transcript.length - 1] : null;

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={handleHangUp}>
      <SafeAreaView style={styles.container}>
        {/* Architectural Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={[styles.statusDot, { backgroundColor: getStatusColor(callStatus, themeColors) }]} />
            <Text style={styles.headerTitle}>LAYA LIVE CALL</Text>
          </View>

          <View style={styles.modelBadge}>
            <MaterialCommunityIcons name="google" size={12} color={themeColors.primary} />
            <Text style={styles.modelBadgeText}>GEMINI 3.8 LIVE</Text>
          </View>
        </View>

        {/* Central Stage: Animated Reactive Sound Orb */}
        <View style={styles.orbStage}>
          {/* Outer Pulsing Ring 2 */}
          <AnimatedView style={[styles.pulseRing, styles.pulseRing2, ring2AnimatedStyle]} />

          {/* Outer Pulsing Ring 1 */}
          <AnimatedView style={[styles.pulseRing, styles.pulseRing1, ring1AnimatedStyle]} />

          {/* Central Glowing Orb */}
          <AnimatedView style={[styles.mainOrb, orbAnimatedStyle]}>
            <MaterialCommunityIcons
              name={callStatus === 'speaking' ? 'waveform' : callStatus === 'thinking' ? 'brain' : 'microphone'}
              size={48}
              color={themeColors.primary}
            />
          </AnimatedView>

          {/* Frequency Equalizer Bars */}
          <View style={styles.equalizerRow}>
            {frequencyBands.map((band, idx) => (
              <View
                key={idx}
                style={[
                  styles.eqBar,
                  {
                    height: Math.max(6, band * 36),
                    backgroundColor: callStatus === 'speaking' ? themeColors.primary : themeColors.textSecondary,
                  },
                ]}
              />
            ))}
          </View>

          {/* Live Status Pill */}
          <View style={styles.statusPill}>
            <Text style={styles.statusPillText}>{statusLabel}</Text>
          </View>
        </View>

        {/* Real-Time Live Transcript Area */}
        <View style={styles.transcriptSection}>
          <Text style={styles.transcriptSuper}>LIVE TRANSCRIPTION STREAM</Text>
          <ScrollView
            style={styles.transcriptScroll}
            contentContainerStyle={styles.transcriptContent}
            showsVerticalScrollIndicator={false}
          >
            {transcript.length === 0 ? (
              <Text style={styles.transcriptPlaceholder}>
                Speak naturally or tap a quick prompt below to analyze your finances, log expenses, or inspect runway...
              </Text>
            ) : (
              transcript.map((line) => (
                <View
                  key={line.id}
                  style={[
                    styles.transcriptRow,
                    line.sender === 'user' ? styles.transcriptRowUser : styles.transcriptRowLaya,
                  ]}
                >
                  <Text style={styles.transcriptSender}>
                    {line.sender === 'user' ? 'YOU' : 'LAYA'}
                  </Text>
                  <Text style={styles.transcriptBody}>{line.text}</Text>
                </View>
              ))
            )}
          </ScrollView>
        </View>

        {/* Quick Voice Prompt Chips */}
        <View style={styles.chipsSection}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
            {QUICK_VOICE_CHIPS.map((chip, idx) => (
              <TouchableOpacity
                key={idx}
                style={styles.chip}
                onPress={() => handleChipPress(chip)}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons name="chat-outline" size={12} color={themeColors.primary} />
                <Text style={styles.chipText}>{chip}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Call Control Dock */}
        <View style={styles.controlsDock}>
          {/* Mute Button */}
          <TouchableOpacity
            style={[styles.controlBtn, isMuted && styles.controlBtnActive]}
            onPress={handleToggleMute}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons
              name={isMuted ? 'microphone-off' : 'microphone'}
              size={22}
              color={isMuted ? themeColors.error : themeColors.text}
            />
            <Text style={styles.controlLabel}>{isMuted ? 'UNMUTE' : 'MUTE'}</Text>
          </TouchableOpacity>

          {/* End Call (Hang Up) */}
          <TouchableOpacity
            style={styles.hangUpBtn}
            onPress={handleHangUp}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="phone-hangup" size={28} color="#FFF" />
          </TouchableOpacity>

          {/* Speaker Button */}
          <TouchableOpacity
            style={[styles.controlBtn, !isSpeakerOn && styles.controlBtnActive]}
            onPress={handleToggleSpeaker}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons
              name={isSpeakerOn ? 'volume-high' : 'volume-off'}
              size={22}
              color={themeColors.text}
            />
            <Text style={styles.controlLabel}>{isSpeakerOn ? 'SPEAKER' : 'EARPIECE'}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const getStatusColor = (status: VoiceCallStatus, colors: any) => {
  switch (status) {
    case 'speaking':
      return colors.primary;
    case 'listening':
      return colors.success;
    case 'thinking':
      return colors.warning;
    case 'muted':
      return colors.error;
    default:
      return colors.textSecondary;
  }
};

const createStyles = (themeColors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#0B0F19',
      justifyContent: 'space-between',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingTop: Platform.OS === 'android' ? spacing.md : spacing.xs,
      paddingBottom: spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: '#1F293D',
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    statusDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    headerTitle: {
      ...typography.caption,
      color: '#FFFFFF',
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 1,
    },
    modelBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#162035',
      borderColor: '#263554',
      borderWidth: 1,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
      gap: 5,
    },
    modelBadgeText: {
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      fontSize: 10,
      color: themeColors.primary,
      fontWeight: '700',
      letterSpacing: 0.5,
    },
    orbStage: {
      alignItems: 'center',
      justifyContent: 'center',
      marginVertical: spacing.lg,
      height: 220,
    },
    pulseRing: {
      position: 'absolute',
      width: 140,
      height: 140,
      borderRadius: 70,
      borderWidth: 1.5,
    },
    pulseRing1: {
      borderColor: themeColors.primary + '40',
    },
    pulseRing2: {
      borderColor: themeColors.primary + '20',
    },
    mainOrb: {
      width: 100,
      height: 100,
      borderRadius: 50,
      backgroundColor: '#162035',
      borderColor: themeColors.primary,
      borderWidth: 1.5,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: themeColors.primary,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.5,
      shadowRadius: 18,
      elevation: 12,
    },
    equalizerRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'center',
      gap: 6,
      height: 40,
      marginTop: spacing.md,
    },
    eqBar: {
      width: 5,
      borderRadius: 3,
    },
    statusPill: {
      marginTop: spacing.sm,
      backgroundColor: '#162035',
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: '#263554',
    },
    statusPillText: {
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      fontSize: 10,
      color: '#FFFFFF',
      fontWeight: '700',
      letterSpacing: 0.5,
    },
    transcriptSection: {
      flex: 1,
      marginHorizontal: spacing.lg,
      backgroundColor: '#111726',
      borderColor: '#1F293D',
      borderWidth: 1,
      borderRadius: 14,
      padding: spacing.md,
      maxHeight: 180,
    },
    transcriptSuper: {
      ...typography.caption,
      fontSize: 9,
      color: themeColors.textSecondary,
      fontWeight: '700',
      letterSpacing: 0.5,
      marginBottom: 6,
    },
    transcriptScroll: {
      flex: 1,
    },
    transcriptContent: {
      paddingBottom: spacing.xs,
    },
    transcriptPlaceholder: {
      ...typography.caption,
      color: '#6B7280',
      fontSize: 11,
      lineHeight: 16,
      fontStyle: 'italic',
    },
    transcriptRow: {
      marginBottom: 6,
    },
    transcriptRowUser: {
      borderLeftWidth: 2,
      borderLeftColor: '#38BDF8',
      paddingLeft: 6,
    },
    transcriptRowLaya: {
      borderLeftWidth: 2,
      borderLeftColor: themeColors.primary,
      paddingLeft: 6,
    },
    transcriptSender: {
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      fontSize: 9,
      fontWeight: '800',
      color: '#9CA3AF',
    },
    transcriptBody: {
      ...typography.body,
      color: '#F3F4F6',
      fontSize: 12,
      lineHeight: 16,
    },
    chipsSection: {
      marginVertical: spacing.sm,
    },
    chipsRow: {
      paddingHorizontal: spacing.lg,
      gap: 8,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#162035',
      borderColor: '#263554',
      borderWidth: 1,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 20,
      gap: 6,
    },
    chipText: {
      ...typography.caption,
      color: '#E5E7EB',
      fontSize: 11,
      fontWeight: '600',
    },
    controlsDock: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-around',
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.lg,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: '#1F293D',
      backgroundColor: '#0E1322',
    },
    controlBtn: {
      alignItems: 'center',
      justifyContent: 'center',
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: '#162035',
      borderColor: '#263554',
      borderWidth: 1,
    },
    controlBtnActive: {
      backgroundColor: '#371B20',
      borderColor: '#7F1D1D',
    },
    controlLabel: {
      ...typography.caption,
      fontSize: 8,
      color: '#9CA3AF',
      fontWeight: '700',
      marginTop: 2,
      letterSpacing: 0.5,
    },
    hangUpBtn: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: '#EF4444',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#EF4444',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.6,
      shadowRadius: 14,
      elevation: 8,
    },
  });
