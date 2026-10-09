/**
 * Purpose: In-app release notes and changelog viewer modal
 *
 * Inputs:
 *   - visible (boolean): Controls modal visibility
 *   - onClose (function): Callback when user closes the modal
 *
 * Outputs:
 *   - Returns (JSX.Element): Detailed version history with features, bug fixes, and performance notes
 */

import React, { useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Platform,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { useThemeColors } from '../../hooks/useThemeColors';
import { lightHaptic } from '../../services/haptics/hapticFeedback';

export interface ReleaseNoteItem {
  version: string;
  title: string;
  date: string;
  isLatest?: boolean;
  features: string[];
  fixes: string[];
  optimizations?: string[];
}

export const RELEASE_HISTORY: ReleaseNoteItem[] = [
  {
    version: '1.0.35',
    title: 'Performance, Touch Speed & Layout Precision',
    date: 'Current Release',
    isLatest: true,
    features: [
      'Built-in in-app Release Notes & Changelog viewer accessible anytime from Settings.',
      'Native screen caching (enableScreens) for instant 60fps stack navigation transitions.',
    ],
    fixes: [
      'Resolved touch response delays: removed default 150ms content touch delays and added instant touch feedback across buttons and bottom tabs.',
      'Isolated horizontal scrolling gestures: inner horizontal elements (wallets strip, filter chips, cash flow scrubbers) no longer trigger tab switching.',
      'Fixed hardware back-button navigation hijacking so child screens and modals pop correctly on Android and iOS.',
      'Fixed calendar 7-column grid layout where the 7th column wrapped to a new line on narrow displays.',
      'Fixed layout overlays and card boundary text collisions with dynamic safe area offsets and font scaling.',
    ],
    optimizations: [
      'Snappy navigation screen transitions (220ms open / 180ms close).',
      'Nested scroll compatibility across all screen containers.',
    ],
  },
  {
    version: '1.0.34',
    title: 'Month Financial Calendar',
    date: 'October 2026',
    features: [
      'Full interactive month calendar displaying daily income, expense, and net totals at a glance.',
      'Visual dot indicators for recurring obligations, subscriptions, and auto-salary deposits.',
      'Daily ledger breakdown sheet opening instantly upon tapping any calendar day.',
      'Filter chips to isolate all events, income only, expenses only, or recurring charges.',
    ],
    fixes: [
      'Accurate end-of-month calendar padding and timezone-aligned date boundaries.',
    ],
  },
  {
    version: '1.0.33',
    title: 'Google Drive Cloud Backup',
    date: 'October 2026',
    features: [
      'Automated and manual ZeroWallet database vault backup to Google Drive.',
      'Configurable background synchronization schedule (Daily, Weekly, Monthly).',
      'One-tap restore from remote cloud backup archives with conflict-safe relational merging.',
    ],
    fixes: [
      'Google Drive OAuth token refresh lifecycle and offline network detection.',
    ],
  },
  {
    version: '1.0.32',
    title: 'Voice Engine Stabilization',
    date: 'October 2026',
    features: [
      'Low-latency voice recognition level metering.',
    ],
    fixes: [
      'Fixed Android VoiceModule Float-to-Double type mismatch in onRmsChanged audio monitoring.',
      'Prevented intermittent voice listener crashes during quiet audio capture.',
    ],
  },
  {
    version: '1.0.31',
    title: 'Goals & Debts Hub & Quick-Add',
    date: 'October 2026',
    features: [
      'Unified Goals & Debts Hub combining target savings and liabilities into a single dashboard.',
      'Central Quick-Add action sheet in the persistent navigation bar for rapid entries.',
      'Global number privacy toggle to instantly conceal balance figures across all views.',
    ],
    fixes: [
      'Debts amortization table rounding precision and target goal progress calculations.',
    ],
  },
  {
    version: '1.0.30',
    title: 'LAYA Local Fast-Path Classifier',
    date: 'October 2026',
    features: [
      'Instant local AI category classifier with zero network dependency.',
      'Native speech synthesis (TTS) for natural voice replies.',
    ],
    fixes: [
      'Prevented chat message bubble overflows on small screen viewports.',
    ],
  },
  {
    version: '1.0.29',
    title: 'LAYA Autonomous Agent & Live Voice',
    date: 'October 2026',
    features: [
      'Conversational AI assistant with full function calling into the SQLite ledger.',
      'Generative charts inside chat messages for visual spending analysis.',
      'Live full-duplex voice calling with interactive real-time audio waveforms.',
    ],
    fixes: [
      'Vault context injection into AI prompts to prevent hallucinated account balances.',
    ],
  },
  {
    version: '1.0.28',
    title: 'Human-In-The-Loop Approvals',
    date: 'October 2026',
    features: [
      'Interactive confirmation notifications for recurring bills and auto-salary deposits.',
      'One-tap approval or deferral right from push notifications or inside the app.',
    ],
    fixes: [
      'Scheduled background job timing accuracy on Android 14+ and iOS background fetch.',
    ],
  },
  {
    version: '1.0.27',
    title: 'Auto-Salary Safeguards',
    date: 'October 2026',
    features: [
      'Configurable salary arrival timing and pay cycle configurations.',
    ],
    fixes: [
      'Strict duplicate salary detection to guarantee salary is never deposited twice.',
    ],
  },
  {
    version: '1.0.26',
    title: 'Multi-Model AI & Global Currencies',
    date: 'October 2026',
    features: [
      'Dynamic AI model selector (Gemini 1.5 Flash, 2.5 Flash, 1.5 Pro).',
      'Full ISO 4217 standard currency support with automated exchange rates.',
    ],
    fixes: [
      'Currency symbol rendering inconsistencies across multi-wallet transfers.',
    ],
  },
];

interface ReleaseNotesModalProps {
  visible: boolean;
  onClose: () => void;
}

export const ReleaseNotesModal: React.FC<ReleaseNotesModalProps> = ({
  visible,
  onClose,
}) => {
  const themeColors = useThemeColors();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);

  const handleClose = () => {
    lightHaptic();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleContainer}>
              <Text style={styles.headerSuper}>ZEROWALLET · CHANGELOG</Text>
              <Text style={styles.headerTitle}>Release Notes</Text>
            </View>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={handleClose}
              delayPressIn={0}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <MaterialCommunityIcons name="close" size={22} color={themeColors.text} />
            </TouchableOpacity>
          </View>

          {/* Subheader */}
          <View style={styles.subHeader}>
            <MaterialCommunityIcons
              name="history"
              size={16}
              color={themeColors.textSecondary}
            />
            <Text style={styles.subHeaderText}>
              Documenting features, bug fixes, and performance updates
            </Text>
          </View>

          {/* Notes Content */}
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {RELEASE_HISTORY.map((item) => (
              <View key={item.version} style={styles.releaseCard}>
                {/* Version Header */}
                <View style={styles.versionHeader}>
                  <View style={styles.versionTagRow}>
                    <View
                      style={[
                        styles.versionPill,
                        item.isLatest ? styles.latestPill : styles.regularPill,
                      ]}
                    >
                      <Text
                        style={[
                          styles.versionPillText,
                          item.isLatest ? styles.latestPillText : styles.regularPillText,
                        ]}
                      >
                        v{item.version}
                      </Text>
                    </View>
                    {item.isLatest && (
                      <View style={styles.activeBadge}>
                        <Text style={styles.activeBadgeText}>LATEST</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.dateText}>{item.date}</Text>
                </View>

                <Text style={styles.cardTitle}>{item.title}</Text>

                {/* Features Section */}
                {item.features.length > 0 && (
                  <View style={styles.sectionBlock}>
                    <View style={styles.sectionTagRow}>
                      <MaterialCommunityIcons
                        name="star-four-points-outline"
                        size={14}
                        color="#10B981"
                      />
                      <Text style={styles.sectionTagText}>NEW FEATURES</Text>
                    </View>
                    {item.features.map((feat, idx) => (
                      <View key={idx} style={styles.bulletRow}>
                        <Text style={styles.bulletDot}>•</Text>
                        <Text style={styles.bulletText}>{feat}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Bug Fixes Section */}
                {item.fixes.length > 0 && (
                  <View style={styles.sectionBlock}>
                    <View style={styles.sectionTagRow}>
                      <MaterialCommunityIcons
                        name="shield-check-outline"
                        size={14}
                        color="#3B82F6"
                      />
                      <Text style={styles.sectionTagText}>BUG FIXES & STABILITY</Text>
                    </View>
                    {item.fixes.map((fix, idx) => (
                      <View key={idx} style={styles.bulletRow}>
                        <Text style={styles.bulletDot}>•</Text>
                        <Text style={styles.bulletText}>{fix}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Performance Optimizations Section */}
                {item.optimizations && item.optimizations.length > 0 && (
                  <View style={styles.sectionBlock}>
                    <View style={styles.sectionTagRow}>
                      <MaterialCommunityIcons
                        name="lightning-bolt-outline"
                        size={14}
                        color="#F59E0B"
                      />
                      <Text style={styles.sectionTagText}>PERFORMANCE & REFINEMENTS</Text>
                    </View>
                    {item.optimizations.map((opt, idx) => (
                      <View key={idx} style={styles.bulletRow}>
                        <Text style={styles.bulletDot}>•</Text>
                        <Text style={styles.bulletText}>{opt}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            ))}

            <View style={styles.footerNote}>
              <Text style={styles.footerNoteText}>
                ZeroWallet · Offline-First Mathematical Ledger
              </Text>
            </View>
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const createStyles = (theme: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.background,
    },
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingTop: Platform.OS === 'android' ? spacing.lg : spacing.md,
      paddingBottom: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.hairline || theme.border,
    },
    headerTitleContainer: {
      flex: 1,
    },
    headerSuper: {
      ...typography.caption,
      color: theme.textSecondary,
      fontSize: 10,
      letterSpacing: 1.5,
      fontWeight: '700',
      marginBottom: 2,
    },
    headerTitle: {
      ...typography.h2,
      color: theme.text,
      fontWeight: '700',
      letterSpacing: 0.5,
    },
    closeButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: theme.glass.background,
      borderWidth: 1,
      borderColor: theme.glass.borderLight,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: spacing.md,
    },
    subHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      backgroundColor: theme.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.hairline || theme.border,
      gap: spacing.xs,
    },
    subHeaderText: {
      ...typography.caption,
      color: theme.textSecondary,
      fontSize: 12,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      padding: spacing.md,
      paddingBottom: spacing.xxl + 20,
      gap: spacing.md,
    },
    releaseCard: {
      borderWidth: 1,
      borderColor: theme.hairline || theme.border,
      backgroundColor: theme.card || theme.surface,
      borderRadius: 4,
      padding: spacing.lg,
      marginBottom: spacing.xs,
    },
    versionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.xs,
    },
    versionTagRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    versionPill: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 3,
      borderRadius: 2,
      borderWidth: 1,
    },
    latestPill: {
      borderColor: theme.primary,
      backgroundColor: theme.primary + '18',
    },
    regularPill: {
      borderColor: theme.border,
      backgroundColor: theme.surface,
    },
    versionPillText: {
      ...typography.caption,
      fontWeight: '800',
      fontSize: 11,
      letterSpacing: 0.5,
    },
    latestPillText: {
      color: theme.primary,
    },
    regularPillText: {
      color: theme.textSecondary,
    },
    activeBadge: {
      backgroundColor: '#10B981',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 2,
    },
    activeBadgeText: {
      color: '#FFFFFF',
      fontSize: 9,
      fontWeight: '800',
      letterSpacing: 0.8,
    },
    dateText: {
      ...typography.caption,
      color: theme.textSecondary,
      fontSize: 11,
    },
    cardTitle: {
      ...typography.h3,
      color: theme.text,
      fontSize: 16,
      fontWeight: '700',
      marginTop: spacing.xs,
      marginBottom: spacing.md,
    },
    sectionBlock: {
      marginTop: spacing.sm,
      marginBottom: spacing.xs,
    },
    sectionTagRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: spacing.xs,
    },
    sectionTagText: {
      ...typography.caption,
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 1,
      color: theme.textSecondary,
    },
    bulletRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginTop: 4,
      paddingLeft: 4,
    },
    bulletDot: {
      color: theme.textSecondary,
      fontSize: 14,
      lineHeight: 18,
      marginRight: 6,
    },
    bulletText: {
      ...typography.body,
      color: theme.text,
      fontSize: 13,
      lineHeight: 18,
      flex: 1,
    },
    footerNote: {
      alignItems: 'center',
      marginTop: spacing.md,
      paddingVertical: spacing.md,
    },
    footerNoteText: {
      ...typography.caption,
      color: theme.textSecondary,
      fontSize: 11,
      letterSpacing: 1,
    },
  });
