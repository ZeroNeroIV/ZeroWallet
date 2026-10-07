/**
 * Purpose: Educational modal explaining Google Drive Cloud Backup, zero-knowledge privacy, and setup
 *
 * Inputs:
 *   - visible (boolean): Whether modal is visible
 *   - onClose (function): Callback to close modal
 *   - onOpenCloudConsole (function): Callback to open Google Cloud Console
 *
 * Outputs:
 *   - Returns (JSX.Element): Google Drive explainer modal component
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
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { lightHaptic, mediumHaptic } from '../../services/haptics/hapticFeedback';
import { useThemeColors } from '../../hooks/useThemeColors';

interface GoogleDriveExplainerModalProps {
  visible: boolean;
  onClose: () => void;
  onGetStarted?: () => void;
}

const GOOGLE_CLOUD_CONSOLE_URL = 'https://console.cloud.google.com/apis/credentials';

export const GoogleDriveExplainerModal: React.FC<GoogleDriveExplainerModalProps> = ({
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

  const handleOpenConsole = async () => {
    mediumHaptic();
    const canOpen = await Linking.canOpenURL(GOOGLE_CLOUD_CONSOLE_URL);
    if (canOpen) {
      await Linking.openURL(GOOGLE_CLOUD_CONSOLE_URL);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.modalContainer} onPress={(e) => e.stopPropagation()}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <MaterialCommunityIcons name="google-drive" size={24} color="#4285F4" style={{ marginRight: 8 }} />
              <Text style={styles.title}>Cloud Backup & Privacy</Text>
            </View>
            <TouchableOpacity onPress={handleClose} hitSlop={10}>
              <MaterialCommunityIcons name="close" size={24} color={themeColors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Privacy Guarantee Banner */}
          <View style={styles.privacyBanner}>
            <MaterialCommunityIcons name="shield-check" size={24} color="#06D6A0" />
            <Text style={styles.privacyBannerText}>100% Client-Side & Private</Text>
          </View>

          {/* Scrollable Content */}
          <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Section 1: How It Works */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>HOW IT WORKS</Text>
              <Text style={styles.paragraph}>
                ZeroWallet communicates directly with your personal Google Drive account. There are no middleman servers, databases, or third parties involved.
              </Text>
            </View>

            {/* Section 2: Scoped Permission */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>STRICT SCOPED PERMISSIONS</Text>
              <View style={styles.bulletItem}>
                <MaterialCommunityIcons name="check-circle" size={18} color="#06D6A0" style={styles.bulletIcon} />
                <Text style={styles.bulletText}>
                  <Text style={styles.boldText}>drive.file scope only: </Text>
                  ZeroWallet can only see and access files that it creates. It has zero access to your photos, personal documents, spreadsheets, or any other Drive folders.
                </Text>
              </View>

              <View style={styles.bulletItem}>
                <MaterialCommunityIcons name="check-circle" size={18} color="#06D6A0" style={styles.bulletIcon} />
                <Text style={styles.bulletText}>
                  <Text style={styles.boldText}>Encrypted & Portable: </Text>
                  Backups are standard ZIP files containing your transaction ledger, receipt images, and configuration, fully restorable on any device.
                </Text>
              </View>

              <View style={styles.bulletItem}>
                <MaterialCommunityIcons name="check-circle" size={18} color="#06D6A0" style={styles.bulletIcon} />
                <Text style={styles.bulletText}>
                  <Text style={styles.boldText}>Automated Scheduled Sync: </Text>
                  Configure Daily, Weekly, or Monthly automation. The app runs backups in the background and rotates out old backups to prevent storage clutter.
                </Text>
              </View>
            </View>

            {/* Section 3: Custom OAuth Setup (For Developers / Power Users) */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>CUSTOM CLIENT ID (OPTIONAL)</Text>
              <Text style={styles.paragraph}>
                If you manage your own Google Cloud project, you can provide your own OAuth 2.0 Client ID or OAuth token in settings. Enable the Google Drive API in Google Cloud Console with the <Text style={styles.codeText}>drive.file</Text> scope.
              </Text>
              <TouchableOpacity style={styles.linkButton} onPress={handleOpenConsole}>
                <MaterialCommunityIcons name="open-in-new" size={16} color="#4285F4" style={{ marginRight: 6 }} />
                <Text style={styles.linkButtonText}>Open Google Cloud Console</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>

          {/* Footer Action */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => {
                handleClose();
                if (onGetStarted) onGetStarted();
              }}
            >
              <Text style={styles.actionButtonText}>GOT IT</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </View>
    </Modal>
  );
};

const createStyles = (themeColors: any) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      justifyContent: 'flex-end',
    },
    modalContainer: {
      backgroundColor: themeColors.surface,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      maxHeight: '85%',
      borderTopWidth: 1,
      borderLeftWidth: 1,
      borderRightWidth: 1,
      borderColor: themeColors.hairline,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
      paddingBottom: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: themeColors.hairline,
    },
    headerTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    title: {
      fontSize: 16,
      fontWeight: '700',
      letterSpacing: 0.5,
      color: themeColors.text,
      textTransform: 'uppercase',
    },
    privacyBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(6, 214, 160, 0.12)',
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      marginHorizontal: spacing.lg,
      marginTop: spacing.md,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: 'rgba(6, 214, 160, 0.3)',
      gap: spacing.sm,
    },
    privacyBannerText: {
      color: '#06D6A0',
      fontSize: 13,
      fontWeight: '700',
      letterSpacing: 0.5,
    },
    scrollView: {
      flexGrow: 0,
    },
    scrollContent: {
      padding: spacing.lg,
    },
    section: {
      marginBottom: spacing.xl,
    },
    sectionTitle: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 1.2,
      color: themeColors.textSecondary,
      marginBottom: spacing.xs,
    },
    paragraph: {
      fontSize: 13,
      lineHeight: 20,
      color: themeColors.text,
    },
    bulletItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginTop: spacing.sm,
    },
    bulletIcon: {
      marginRight: spacing.sm,
      marginTop: 2,
    },
    bulletText: {
      flex: 1,
      fontSize: 13,
      lineHeight: 19,
      color: themeColors.text,
    },
    boldText: {
      fontWeight: '700',
      color: themeColors.text,
    },
    codeText: {
      fontFamily: 'monospace',
      backgroundColor: 'rgba(255, 255, 255, 0.08)',
      paddingHorizontal: 4,
    },
    linkButton: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: spacing.sm,
      paddingVertical: spacing.xs,
    },
    linkButtonText: {
      fontSize: 13,
      fontWeight: '600',
      color: '#4285F4',
    },
    footer: {
      padding: spacing.lg,
      borderTopWidth: 1,
      borderTopColor: themeColors.hairline,
    },
    actionButton: {
      backgroundColor: themeColors.text,
      paddingVertical: spacing.md,
      borderRadius: 8,
      alignItems: 'center',
    },
    actionButtonText: {
      color: themeColors.background,
      fontSize: 13,
      fontWeight: '700',
      letterSpacing: 1,
    },
  });
