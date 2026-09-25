/**
 * Purpose: Configure Google Gemini AI settings (API key and model selection)
 *
 * Inputs:
 *   - navigation (AISettingsScreenProps): Navigation object from React Navigation
 *
 * Outputs:
 *   - Returns (JSX.Element): Simple AI settings form
 *
 * Side effects:
 *   - Updates AI settings in settingsStore
 *   - Opens browser to Google AI Studio
 *   - Validates API key with Google
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Linking,
  ActivityIndicator,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSettingsStore } from '../../store/settingsStore';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { compatColors as colors } from '../../theme/colors';
import { useThemeColors } from '../../hooks/useThemeColors';
import { lightHaptic, mediumHaptic } from '../../services/haptics/hapticFeedback';
import { GEMINI_MODELS } from '../../constants/geminiModels';

const AI_STUDIO_URL = 'https://aistudio.google.com/app/apikey';

const AISettingsScreen = ({ navigation }: any) => {
  const store = useSettingsStore();
  const aiSettings = store.aiSettings;
  const updateAISettings = store.updateAISettings;
  const themeColors = useThemeColors();

  const [apiKey, setApiKey] = useState(aiSettings?.apiKey || '');
  const [showApiKey, setShowApiKey] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const styles = useMemo(() => createStyles(themeColors), [themeColors]);

  const handleApiKeyChange = useCallback((text: string) => {
    setApiKey(text.trim());
    setHasChanges(true);
  }, []);

  // Open Google AI Studio to get a free API key
  const handleGetAPIKey = useCallback(async () => {
    mediumHaptic();
    const canOpen = await Linking.canOpenURL(AI_STUDIO_URL);
    if (canOpen) {
      await Linking.openURL(AI_STUDIO_URL);
    } else {
      Alert.alert('Cannot open link', 'Copy this into your browser:\n' + AI_STUDIO_URL);
    }
  }, []);

  // Validate API key
  const handleTestConnection = useCallback(async () => {
    if (!apiKey || apiKey.length === 0) {
      Alert.alert('Error', 'Please enter an API key first');
      return;
    }

    setIsValidating(true);
    mediumHaptic();

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.ok) {
        Alert.alert(
          'Success!',
          'Your API key is valid and working. Don\'t forget to save!',
          [{ text: 'OK', style: 'default' }]
        );
      } else {
        const errorData = await response.json();
        Alert.alert(
          'Invalid API Key',
          errorData.error?.message || 'The API key appears to be invalid. Please check and try again.',
          [{ text: 'OK', style: 'default' }]
        );
      }
    } catch (error: any) {
      Alert.alert(
        'Connection Error',
        'Could not connect to Google AI. Please check your internet connection and try again.',
        [{ text: 'OK', style: 'default' }]
      );
    } finally {
      setIsValidating(false);
    }
  }, [apiKey]);

  // Save settings
  const handleSave = useCallback(() => {
    if (!apiKey || apiKey.length === 0) {
      Alert.alert('Error', 'Please enter an API key');
      return;
    }

    mediumHaptic();

    updateAISettings({
      apiKey,
      isConfigured: true,
    });

    setHasChanges(false);

    Alert.alert(
      'Settings Saved!',
      'Your AI assistant is ready to use. You can now ask questions about your finances!',
      [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]
    );
  }, [apiKey, navigation, updateAISettings]);

  // Clear API key
  const handleClearKey = useCallback(() => {
    Alert.alert(
      'Clear API Key?',
      'This will remove your API key and disable the AI assistant. You can always add it back later.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            mediumHaptic();
            setApiKey('');
            updateAISettings({
              apiKey: null,
              isConfigured: false,
            });
            Alert.alert('Cleared', 'API key removed successfully');
          },
        },
      ]
    );
  }, [updateAISettings]);

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Status */}
        <View style={styles.statusCard}>
          <MaterialCommunityIcons
            name={aiSettings?.isConfigured ? 'check-circle' : 'alert-circle'}
            size={24}
            color={aiSettings?.isConfigured ? colors.success.main : colors.warning.main}
          />
          <Text style={styles.statusText}>
            {aiSettings?.isConfigured ? 'AI Assistant ready' : 'AI Assistant not set up'}
          </Text>
        </View>

        {/* Get Free API Key — direct link to Google AI Studio */}
        <TouchableOpacity style={styles.getKeyButton} onPress={handleGetAPIKey}>
          <MaterialCommunityIcons name="key-variant" size={20} color="#fff" />
          <View style={styles.getKeyContent}>
            <Text style={styles.getKeyText}>Get a free API key</Text>
            <Text style={styles.getKeySubtext}>Google AI Studio · aistudio.google.com</Text>
          </View>
          <MaterialCommunityIcons name="open-in-new" size={18} color="#fff" />
        </TouchableOpacity>

        {/* API Key Input */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>API Key</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              value={showApiKey ? apiKey : apiKey.replace(/./g, '•')}
              onChangeText={handleApiKeyChange}
              placeholder="Paste your key here"
              placeholderTextColor={themeColors.textSecondary}
              secureTextEntry={false}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={styles.eyeButton}
              onPress={() => {
                lightHaptic();
                setShowApiKey((prev) => !prev);
              }}
              hitSlop={10}
            >
              <MaterialCommunityIcons
                name={showApiKey ? 'eye-off' : 'eye'}
                size={20}
                color={themeColors.textSecondary}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Test + Save */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.testButton, (!apiKey || isValidating) && styles.buttonDisabled]}
            onPress={handleTestConnection}
            disabled={isValidating || !apiKey}
          >
            {isValidating ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <MaterialCommunityIcons name="connection" size={20} color="#fff" />
                <Text style={styles.buttonText}>Test</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.saveButton, (!hasChanges && !apiKey) && styles.buttonDisabled]}
            onPress={handleSave}
            disabled={!hasChanges && !apiKey}
          >
            <MaterialCommunityIcons name="check" size={20} color="#fff" />
            <Text style={styles.buttonText}>Save</Text>
          </TouchableOpacity>
        </View>

        {/* Model */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Model</Text>
          {GEMINI_MODELS.map((model) => {
            const selected = aiSettings?.selectedModel === model.id;
            return (
              <TouchableOpacity
                key={model.id}
                style={[styles.modelRow, selected && styles.modelRowActive]}
                onPress={() => {
                  lightHaptic();
                  updateAISettings({ selectedModel: model.id });
                }}
              >
                <View style={styles.modelInfo}>
                  <Text style={styles.modelName}>{model.name}</Text>
                  <Text style={styles.modelDescription} numberOfLines={1}>
                    {model.description}
                  </Text>
                </View>
                {model.recommended && (
                  <View style={styles.recommendedBadge}>
                    <Text style={styles.recommendedText}>★</Text>
                  </View>
                )}
                {selected && (
                  <MaterialCommunityIcons
                    name="check-circle"
                    size={22}
                    color={colors.success.main}
                  />
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {aiSettings?.isConfigured && (
          <TouchableOpacity style={styles.clearButton} onPress={handleClearKey}>
            <MaterialCommunityIcons
              name="delete"
              size={20}
              color={colors.error.main}
            />
            <Text style={styles.clearButtonText}>Remove API Key</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
};

const createStyles = (themeColors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: themeColors.background,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      padding: spacing.lg,
      paddingBottom: spacing.xl,
    },
    statusCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: themeColors.surface,
      padding: spacing.md,
      borderRadius: 12,
      marginBottom: spacing.md,
      borderWidth: 1,
      borderColor: themeColors.border,
    },
    statusText: {
      ...typography.body,
      color: themeColors.text,
      fontWeight: '600',
    },
    getKeyButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.success.main,
      padding: spacing.md,
      borderRadius: 12,
      marginBottom: spacing.lg,
      gap: spacing.sm,
    },
    getKeyContent: {
      flex: 1,
    },
    getKeyText: {
      ...typography.body,
      color: '#fff',
      fontWeight: '700',
    },
    getKeySubtext: {
      ...typography.caption,
      color: '#fff',
      opacity: 0.9,
    },
    section: {
      marginBottom: spacing.lg,
    },
    sectionTitle: {
      ...typography.h4,
      color: themeColors.text,
      marginBottom: spacing.sm,
      fontWeight: '600',
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: themeColors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: themeColors.border,
      paddingHorizontal: spacing.md,
    },
    input: {
      ...typography.body,
      color: themeColors.text,
      flex: 1,
      paddingVertical: spacing.md,
    },
    eyeButton: {
      padding: spacing.xs,
    },
    actionsRow: {
      flexDirection: 'row',
      gap: spacing.md,
      marginBottom: spacing.lg,
    },
    testButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.info.main,
      padding: spacing.md,
      borderRadius: 12,
      gap: spacing.sm,
    },
    saveButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary.main,
      padding: spacing.md,
      borderRadius: 12,
      gap: spacing.sm,
    },
    buttonDisabled: {
      opacity: 0.5,
    },
    buttonText: {
      ...typography.body,
      color: '#fff',
      fontWeight: '600',
    },
    modelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: themeColors.surface,
      padding: spacing.md,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: themeColors.border,
      marginBottom: spacing.sm,
      gap: spacing.sm,
    },
    modelRowActive: {
      borderColor: colors.success.main,
    },
    modelInfo: {
      flex: 1,
    },
    modelName: {
      ...typography.body,
      color: themeColors.text,
      fontWeight: '700',
    },
    modelDescription: {
      ...typography.caption,
      color: themeColors.textSecondary,
    },
    recommendedBadge: {
      backgroundColor: colors.warning.main,
      width: 24,
      height: 24,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    recommendedText: {
      color: '#fff',
      fontSize: 12,
      fontWeight: '700',
    },
    clearButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: themeColors.surface,
      padding: spacing.md,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.error.main,
      gap: spacing.sm,
    },
    clearButtonText: {
      ...typography.body,
      color: colors.error.main,
      fontWeight: '600',
    },
  });

export default AISettingsScreen;
