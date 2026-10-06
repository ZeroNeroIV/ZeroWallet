/**
 * LayaLiveCallModal — Immersive Live Voice Call Interface
 *
 * Full-screen architectural HUD for bidirectional real-time audio interaction with the AI Copilot.
 * Features:
 *  - Animated reactive soundwaves reacting to live mic input & speech
 *  - Real-time live transcription stream
 *  - Frequency audio spectrum visualizer
 *  - Clear foundation model identity (Gemini 3.8 Flash / Groq)
 *  - Quick financial prompt chips and push-to-talk controls
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
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  const insets = useSafeAreaInsets();
  const themeColors = useThemeColors();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);

  const [callStatus, setCallStatus] = useState<VoiceCallStatus>('connecting');
  const [transcript, setTranscript] = useState<LiveTranscriptLine[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [frequencyBands, setFrequencyBands] = useState<number[]>([0.15, 0.35, 0.5, 0.35, 0.15]);

  // Animated values for central sound orb
  const pulseScale = useSharedValue(1);
  const ringScale1 = useSharedValue(1);
  const ringScale2 = useSharedValue(1);
  const ringOpacity1 = useSharedValue(0.5);
  const ringOpacity2 = useSharedValue(0.25);

  const modelBadgeText = useMemo(() => {
    return voiceService?.getModelName() || 'GEMINI 3.8 FLASH';
  }, [voiceService]);

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
      // Animate pulsing scale based on real mic/speech intensity
      pulseScale.value = withTiming(1 + level * 0.35, { duration: 75 });
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
        withTiming(1.35, { duration: 1600, easing: Easing.out(Easing.ease) }),
        withTiming(1, { duration: 1600, easing: Easing.in(Easing.ease) })
      ),
      -1,
      true
    );

    ringScale2.value = withRepeat(
      withSequence(
        withTiming(1.7, { duration: 2200, easing: Easing.out(Easing.ease) }),
        withTiming(1, { duration: 2200, easing: Easing.in(Easing.ease) })
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
        return 'CONNECTING TO AI COPILOT...';
      case 'connected':
        return 'VOICE SESSION ACTIVE';
      case 'listening':
        return 'LISTENING (SPEAK FREELY)...';
      case 'thinking':
        return 'ANALYZING FINANCIAL LEDGER...';
      case 'speaking':
        return 'AI IS SPEAKING';
      case 'muted':
        return 'MICROPHONE MUTED';
      default:
        return 'OFFLINE';
    }
  }, [callStatus]);

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={handleHangUp}>
      <View style={[styles.container, { paddingTop: Math.max(insets.top, 12), paddingBottom: Math.max(insets.bottom, 12) }]}>
        {/* Architectural Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={[styles.statusDot, { backgroundColor: getStatusColor(callStatus, themeColors) }]} />
            <Text style={styles.headerTitle} numberOfLines={1}>
              AI LIVE VOICE
            </Text>
          </View>

          <View style={styles.modelBadge}>
            <MaterialCommunityIcons name="lightning-bolt" size={11} color={themeColors.primary} />
            <Text style={styles.modelBadgeText} numberOfLines={1}>
              {modelBadgeText}
            </Text>
          </View>
        </View>

        {/* Central Stage: Animated Reactive Sound Orb */}
        <View style={styles.orbStage}>
          {/* Outer Pulsing Ring 2 */}
          <AnimatedView style={[styles.pulseRing, styles.pulseRing2, ring2AnimatedStyle]} />

          {/* Outer Pulsing Ring 1 */}
          <AnimatedView style={[styles.pulseRing, styles.pulseRing1, ring1AnimatedStyle]} />

          {/* Central Glowing Orb */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => {
              if (callStatus === 'speaking') {
                handleToggleMute();
              } else {
                lightHaptic();
              }
            }}
          >
            <AnimatedView style={[styles.mainOrb, orbAnimatedStyle]}>
              <MaterialCommunityIcons
                name={callStatus === 'speaking' ? 'waveform' : callStatus === 'thinking' ? 'brain' : isMuted ? 'microphone-off' : 'microphone'}
                size={36}
                color={isMuted ? themeColors.error : themeColors.primary}
              />
            </AnimatedView>
          </TouchableOpacity>

          {/* Frequency Equalizer Bars */}
          <View style={styles.equalizerRow}>
            {frequencyBands.map((band, idx) => (
              <View
                key={idx}
                style={[
                  styles.eqBar,
                  {
                    height: Math.max(6, band * 32),
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
                    {line.sender === 'user' ? 'YOU' : 'AI'}
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
                <Text style={styles.chipText} numberOfLines={1}>{chip}</Text>
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
              size={20}
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
            <MaterialCommunityIcons name="phone-hangup" size={26} color="#FFF" />
          </TouchableOpacity>

          {/* Speaker Button */}
          <TouchableOpacity
            style={[styles.controlBtn, !isSpeakerOn && styles.controlBtnActive]}
            onPress={handleToggleSpeaker}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons
              name={isSpeakerOn ? 'volume-high' : 'volume-off'}
              size={20}
              color={themeColors.text}
            />
            <Text style={styles.controlLabel}>{isSpeakerOn ? 'SPEAKER' : 'MUTE AUDIO'}</Text>
          </TouchableOpacity>
        </View>
      </View>
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
    case 'connecting':
      return colors.textSecondary;
    default:
      return colors.border;
  }
};

const createStyles = (themeColors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: themeColors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: themeColors.hairline || themeColors.border,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs + 2,
      flex: 1,
      minWidth: 0,
    },
    statusDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    headerTitle: {
      ...typography.caption,
      color: themeColors.text,
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 1,
    },
    modelBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      borderWidth: 1,
      borderColor: themeColors.hairline || themeColors.border,
      paddingHorizontal: spacing.xs + 2,
      paddingVertical: 3,
      borderRadius: 2,
      backgroundColor: themeColors.card || themeColors.surface,
      flexShrink: 0,
      maxWidth: 160,
    },
    modelBadgeText: {
      ...typography.caption,
      color: themeColors.text,
      fontSize: 9,
      fontWeight: '700',
      letterSpacing: 0.5,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    orbStage: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.xs + 2,
      position: 'relative',
    },
    pulseRing: {
      position: 'absolute',
      width: 114,
      height: 114,
      borderRadius: 57,
      borderWidth: 1,
      borderColor: themeColors.primary + '30',
    },
    pulseRing1: {
      borderColor: themeColors.primary + '40',
    },
    pulseRing2: {
      borderColor: themeColors.primary + '20',
    },
    mainOrb: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: themeColors.card || themeColors.surface,
      borderWidth: 1,
      borderColor: themeColors.primary + '60',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: themeColors.primary,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.35,
      shadowRadius: 10,
      elevation: 5,
    },
    equalizerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      marginTop: spacing.xs + 2,
      height: 28,
    },
    eqBar: {
      width: 4,
      borderRadius: 2,
    },
    statusPill: {
      marginTop: spacing.xs,
      paddingHorizontal: spacing.sm + 4,
      paddingVertical: 3,
      borderRadius: 12,
      backgroundColor: themeColors.card || themeColors.surface,
      borderWidth: 1,
      borderColor: themeColors.hairline || themeColors.border,
    },
    statusPillText: {
      ...typography.caption,
      fontSize: 9,
      fontWeight: '700',
      letterSpacing: 1,
      color: themeColors.textSecondary,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    transcriptSection: {
      flex: 1,
      marginHorizontal: spacing.md,
      marginVertical: spacing.xs,
      borderWidth: 1,
      borderColor: themeColors.hairline || themeColors.border,
      borderRadius: 4,
      backgroundColor: themeColors.card || themeColors.surface,
      padding: spacing.sm,
      minHeight: 80,
    },
    transcriptSuper: {
      ...typography.caption,
      fontSize: 8,
      fontWeight: '800',
      letterSpacing: 1.2,
      color: themeColors.textSecondary,
      marginBottom: spacing.xs,
    },
    transcriptScroll: {
      flex: 1,
    },
    transcriptContent: {
      paddingBottom: spacing.sm,
      gap: spacing.xs + 2,
    },
    transcriptPlaceholder: {
      ...typography.body,
      color: themeColors.textSecondary,
      fontSize: 11,
      lineHeight: 16,
      fontStyle: 'italic',
      textAlign: 'center',
      marginTop: spacing.lg,
      paddingHorizontal: spacing.md,
    },
    transcriptRow: {
      padding: spacing.xs + 2,
      borderRadius: 3,
      borderLeftWidth: 2,
    },
    transcriptRowUser: {
      borderLeftColor: themeColors.primary,
      backgroundColor: themeColors.background,
    },
    transcriptRowLaya: {
      borderLeftColor: themeColors.text,
      backgroundColor: themeColors.surface,
    },
    transcriptSender: {
      ...typography.caption,
      fontSize: 8,
      fontWeight: '800',
      letterSpacing: 0.8,
      color: themeColors.textSecondary,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      marginBottom: 2,
    },
    transcriptBody: {
      ...typography.body,
      fontSize: 12,
      color: themeColors.text,
      lineHeight: 17,
    },
    chipsSection: {
      paddingVertical: 6,
    },
    chipsRow: {
      paddingHorizontal: spacing.md,
      gap: spacing.xs,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: spacing.sm,
      paddingVertical: 5,
      borderRadius: 3,
      backgroundColor: themeColors.card || themeColors.surface,
      borderWidth: 1,
      borderColor: themeColors.hairline || themeColors.border,
    },
    chipText: {
      ...typography.caption,
      fontSize: 10,
      color: themeColors.text,
      fontWeight: '600',
    },
    controlsDock: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-around',
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.md,
      borderTopWidth: 1,
      borderTopColor: themeColors.hairline || themeColors.border,
      backgroundColor: themeColors.background,
    },
    controlBtn: {
      alignItems: 'center',
      justifyContent: 'center',
      width: 64,
      paddingVertical: 6,
      borderRadius: 4,
      borderWidth: 1,
      borderColor: themeColors.hairline || themeColors.border,
      backgroundColor: themeColors.card || themeColors.surface,
      gap: 4,
    },
    controlBtnActive: {
      borderColor: themeColors.error,
      backgroundColor: themeColors.error + '15',
    },
    controlLabel: {
      ...typography.caption,
      fontSize: 8,
      fontWeight: '700',
      letterSpacing: 0.5,
      color: themeColors.textSecondary,
    },
    hangUpBtn: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: '#FF3B30',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#FF3B30',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.4,
      shadowRadius: 8,
      elevation: 6,
    },
  });
