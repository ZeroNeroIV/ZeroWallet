/**
 * Purpose: Educational modal explaining Gemini AI, free API key setup, and model selection
 *
 * Inputs:
 *   - visible (boolean): Whether modal is visible
 *   - onClose (function): Callback to close modal
 *   - onGetStarted (function): Callback when user clicks "Got it, let's set it up!"
 *
 * Outputs:
 *   - Returns (JSX.Element): Gemini explainer modal component
 *
 * Side effects:
 *   - Opens Google AI Studio URL in browser when "Get Free API Key" pressed
 *   - Triggers haptic feedback on button presses
 */

import React, { useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  ScrollView,
  Linking,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { compatColors as colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { lightHaptic, mediumHaptic } from '../../services/haptics/hapticFeedback';
import { useThemeColors } from '../../hooks/useThemeColors';
import { GEMINI_MODELS, TOKENS_EXPLANATION } from '../../constants/geminiModels';

interface GeminiExplainerModalProps {
  visible: boolean;
  onClose: () => void;
  onGetStarted: () => void;
}

export const GeminiExplainerModal: React.FC<GeminiExplainerModalProps> = ({
  visible,
  onClose,
  onGetStarted,
}) => {
  const themeColors = useThemeColors();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);

  const handleClose = () => {
    lightHaptic();
    onClose();
  };

  const handleGetAPIKey = async () => {
    mediumHaptic();
    const url = 'https://aistudio.google.com/app/apikey';
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
    }
  };

  const handleGetStarted = () => {
    mediumHaptic();
    onGetStarted();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.backdrop}>
        <Pressable style={styles.modalContainer} onPress={(e) => e.stopPropagation()}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>AI Assistant</Text>
            <TouchableOpacity onPress={handleClose} hitSlop={10}>
              <MaterialCommunityIcons
                name="close"
                size={24}
                color={themeColors.textSecondary}
              />
            </TouchableOpacity>
          </View>

          {/* 100% FREE Banner */}
          <View style={styles.freeBanner}>
            <MaterialCommunityIcons name="gift" size={24} color="#fff" />
            <Text style={styles.freeBannerText}>100% FREE Forever</Text>
            <MaterialCommunityIcons name="party-popper" size={24} color="#fff" />
          </View>

          {/* Scrollable Content */}
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Section 1: What is Gemini? */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>What is Gemini?</Text>
              <Text style={styles.sectionText}>
                Gemini is Google's AI that can answer questions about your finances. Ask it anything like:
              </Text>
              <View style={styles.examplesList}>
                <Text style={styles.exampleText}>💰 "How much did I spend on food this month?"</Text>
                <Text style={styles.exampleText}>📊 "What are my biggest expenses?"</Text>
                <Text style={styles.exampleText}>🎯 "Am I on track with my savings goals?"</Text>
                <Text style={styles.exampleText}>💳 "Show my recent transactions"</Text>
              </View>
            </View>

            {/* Section 2: It's Completely FREE! */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>It's Completely FREE!</Text>
              <View style={styles.checkmarksList}>
                <View style={styles.checkmarkRow}>
                  <MaterialCommunityIcons name="check-circle" size={20} color={colors.success.main} />
                  <Text style={styles.checkmarkText}>No credit card needed</Text>
                </View>
                <View style={styles.checkmarkRow}>
                  <MaterialCommunityIcons name="check-circle" size={20} color={colors.success.main} />
                  <Text style={styles.checkmarkText}>No payment ever required</Text>
                </View>
                <View style={styles.checkmarkRow}>
                  <MaterialCommunityIcons name="check-circle" size={20} color={colors.success.main} />
                  <Text style={styles.checkmarkText}>Unlimited conversations</Text>
                </View>
                <View style={styles.checkmarkRow}>
                  <MaterialCommunityIcons name="check-circle" size={20} color={colors.success.main} />
                  <Text style={styles.checkmarkText}>No hidden charges</Text>
                </View>
              </View>
            </View>

            {/* Section 3: How to Get Your Free API Key */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>How to Get Your Free API Key (3 Steps)</Text>
              <View style={styles.stepsList}>
                <View style={styles.stepRow}>
                  <View style={styles.stepNumber}>
                    <Text style={styles.stepNumberText}>1</Text>
                  </View>
                  <Text style={styles.stepText}>
                    Click "Get My Free API Key" below (opens Google AI Studio)
                  </Text>
                </View>
                <View style={styles.stepRow}>
                  <View style={styles.stepNumber}>
                    <Text style={styles.stepNumberText}>2</Text>
                  </View>
                  <Text style={styles.stepText}>
                    Sign in with your Google account (Gmail)
                  </Text>
                </View>
                <View style={styles.stepRow}>
                  <View style={styles.stepNumber}>
                    <Text style={styles.stepNumberText}>3</Text>
                  </View>
                  <Text style={styles.stepText}>
                    Click "Create API Key" and copy it
                  </Text>
                </View>
              </View>

              <TouchableOpacity style={styles.getKeyButton} onPress={handleGetAPIKey}>
                <MaterialCommunityIcons name="key-variant" size={20} color="#fff" />
                <Text style={styles.getKeyButtonText}>Get My Free API Key</Text>
                <MaterialCommunityIcons name="open-in-new" size={18} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Section 4: Privacy & Security */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Privacy & Security</Text>
              <Text style={styles.sectionText}>
                <MaterialCommunityIcons name="shield-check" size={16} color={colors.primary.main} />
                {' '}Your API key is stored securely on your device (never shared).
              </Text>
              <Text style={styles.sectionText}>
                <MaterialCommunityIcons name="lock" size={16} color={colors.primary.main} />
                {' '}Your financial data stays private (only you can access it).
              </Text>
              <Text style={styles.sectionText}>
                <MaterialCommunityIcons name="eye-off" size={16} color={colors.primary.main} />
                {' '}Conversations are not used to train Google's AI models.
              </Text>
            </View>

            {/* Section 5: What Are Tokens? */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>What Are Tokens?</Text>
              <Text style={styles.sectionText}>{TOKENS_EXPLANATION}</Text>
            </View>

            {/* Section 6: Which Model Should I Choose? */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Which Model Should I Choose?</Text>
              {GEMINI_MODELS.map((model) => (
                <View
                  key={model.id}
                  style={[
                    styles.modelCard,
                    model.recommended && styles.modelCardRecommended,
                  ]}
                >
                  <View style={styles.modelHeader}>
                    <Text style={styles.modelName}>{model.name}</Text>
                    {model.recommended && (
                      <View style={styles.recommendedBadge}>
                        <Text style={styles.recommendedText}>Recommended</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.modelDescription}>{model.description}</Text>
                  <View style={styles.modelBadges}>
                    <Text style={styles.modelBadge}>
                      {'⚡'.repeat(model.speed)} Speed
                    </Text>
                    <Text style={styles.modelBadge}>
                      {'⭐'.repeat(model.accuracy)} Accuracy
                    </Text>
                  </View>
                  <Text style={styles.modelBestFor}>Best for: {model.bestFor}</Text>
                </View>
              ))}
            </View>
          </ScrollView>

          {/* Footer Button */}
          <TouchableOpacity style={styles.startButton} onPress={handleGetStarted}>
            <Text style={styles.startButtonText}>Got it, let's set it up!</Text>
            <MaterialCommunityIcons name="arrow-right" size={20} color="#fff" />
          </TouchableOpacity>
        </Pressable>
      </View>
    </Modal>
  );
};

const createStyles = (themeColors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    modalContainer: {
      backgroundColor: themeColors.background,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      maxHeight: '90%',
      paddingTop: spacing.lg,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      marginBottom: spacing.md,
    },
    title: {
      ...typography.h2,
      color: themeColors.text,
    },
    freeBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.success.main,
      paddingVertical: spacing.sm,
      marginHorizontal: spacing.lg,
      marginBottom: spacing.md,
      borderRadius: 12,
      gap: spacing.sm,
    },
    freeBannerText: {
      ...typography.h3,
      color: '#fff',
      fontWeight: '700',
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.md,
    },
    section: {
      marginBottom: spacing.lg,
    },
    sectionTitle: {
      ...typography.h3,
      color: themeColors.text,
      marginBottom: spacing.sm,
    },
    sectionText: {
      ...typography.body,
      color: themeColors.textSecondary,
      lineHeight: 22,
      marginBottom: spacing.xs,
    },
    examplesList: {
      gap: spacing.xs,
      marginTop: spacing.xs,
    },
    exampleText: {
      ...typography.body,
      color: themeColors.text,
      paddingLeft: spacing.sm,
    },
    checkmarksList: {
      gap: spacing.sm,
    },
    checkmarkRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    checkmarkText: {
      ...typography.body,
      color: themeColors.text,
    },
    stepsList: {
      gap: spacing.md,
      marginBottom: spacing.md,
    },
    stepRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
    },
    stepNumber: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.primary.main,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepNumberText: {
      ...typography.body,
      color: '#fff',
      fontWeight: '700',
    },
    stepText: {
      ...typography.body,
      color: themeColors.text,
      flex: 1,
      paddingTop: 2,
    },
    getKeyButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.success.main,
      paddingVertical: spacing.md,
      borderRadius: 12,
      gap: spacing.sm,
    },
    getKeyButtonText: {
      ...typography.body,
      color: '#fff',
      fontWeight: '600',
    },
    modelCard: {
      backgroundColor: themeColors.surface,
      padding: spacing.md,
      borderRadius: 12,
      marginBottom: spacing.sm,
      borderWidth: 2,
      borderColor: themeColors.border,
    },
    modelCardRecommended: {
      borderColor: colors.primary.main,
      backgroundColor: colors.primary.light + '15',
    },
    modelHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.xs,
    },
    modelName: {
      ...typography.h4,
      color: themeColors.text,
      fontWeight: '600',
    },
    recommendedBadge: {
      backgroundColor: colors.primary.main,
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
      borderRadius: 6,
    },
    recommendedText: {
      ...typography.caption,
      color: '#fff',
      fontWeight: '600',
    },
    modelDescription: {
      ...typography.body,
      color: themeColors.textSecondary,
      marginBottom: spacing.xs,
    },
    modelBadges: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginBottom: spacing.xs,
    },
    modelBadge: {
      ...typography.caption,
      color: themeColors.textSecondary,
    },
    modelBestFor: {
      ...typography.caption,
      color: themeColors.text,
      fontStyle: 'italic',
    },
    startButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary.main,
      paddingVertical: spacing.md,
      marginHorizontal: spacing.lg,
      marginBottom: spacing.lg,
      borderRadius: 12,
      gap: spacing.sm,
    },
    startButtonText: {
      ...typography.body,
      color: '#fff',
      fontWeight: '600',
    },
  });
