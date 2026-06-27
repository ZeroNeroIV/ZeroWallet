/**
 * Purpose: Configure Google Gemini AI settings (API key and model selection)
 *
 * Inputs:
 *   - navigation (AISettingsScreenProps): Navigation object from React Navigation
 *
 * Outputs:
 *   - Returns (JSX.Element): AI settings configuration form
 *
 * Side effects:
 *   - Updates AI settings in settingsStore
 *   - Opens Gemini explainer modal
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
import { GeminiExplainerModal } from './GeminiExplainerModal';
import { getModelById, GEMINI_MODELS } from '../../constants/geminiModels';

const AISettingsScreen = ({ navigation }: any) => {
  const store = useSettingsStore();
  const aiSettings = store.aiSettings || {
    apiKey: null,
    selectedModel: 'gemini-2.5-flash',
    isConfigured: false,
    totalTokensUsed: 0,
    conversationCount: 0,
    lastUsed: null,
  };
  const updateAISettings = store.updateAISettings;
  const themeColors = useThemeColors();

  const [apiKey, setApiKey] = useState(aiSettings?.apiKey || '');
  const [showApiKey, setShowApiKey] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [showExplainer, setShowExplainer] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const styles = useMemo(() => createStyles(themeColors), [themeColors]);

  const currentModel = useMemo(
    () => getModelById(aiSettings?.selectedModel || 'gemini-2.5-flash'),
    [aiSettings?.selectedModel]
  );

  // Handle API key change
  const handleApiKeyChange = useCallback((text: string) => {
    setApiKey(text.trim());
    setHasChanges(true);
  }, []);

  // Toggle API key visibility
  const handleToggleShowKey = useCallback(() => {
    lightHaptic();
    setShowApiKey((prev) => !prev);
  }, []);

  // Open explainer modal
  const handleShowExplainer = useCallback(() => {
    mediumHaptic();
    setShowExplainer(true);
  }, []);

  // Open Google AI Studio to get API key
  const handleGetAPIKey = useCallback(async () => {
    mediumHaptic();
    const url = 'https://aistudio.google.com/app/apikey';
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
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
      // Test the API key with a simple request
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

  // Navigate to model selection
  const handleSelectModel = useCallback((modelId: string) => {
    lightHaptic();
    updateAISettings({
      selectedModel: modelId,
    });
    Alert.alert('Model Updated', `Switched to ${getModelById(modelId)?.name}`);
  }, [updateAISettings]);

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
        {/* 100% FREE Badge */}
        <View style={styles.freeBadge}>
          <MaterialCommunityIcons name="gift" size={20} color="#fff" />
          <Text style={styles.freeBadgeText}>100% FREE Forever - No Credit Card</Text>
        </View>

        {/* Status Card */}
        <View style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <MaterialCommunityIcons
              name={aiSettings?.isConfigured ? 'check-circle' : 'alert-circle'}
              size={24}
              color={aiSettings?.isConfigured ? colors.success.main : colors.warning.main}
            />
            <Text style={styles.statusText}>
              {aiSettings?.isConfigured ? 'AI Assistant Configured' : 'Not Configured'}
            </Text>
          </View>

          {aiSettings?.isConfigured && (
            <>
              <View style={styles.statusRow}>
                <Text style={styles.statusLabel}>Current Model:</Text>
                <Text style={styles.statusValue}>{currentModel?.name || 'Flash'}</Text>
              </View>
              <View style={styles.statusRow}>
                <Text style={styles.statusLabel}>Conversations:</Text>
                <Text style={styles.statusValue}>{aiSettings?.conversationCount || 0}</Text>
              </View>
              <View style={styles.statusRow}>
                <Text style={styles.statusLabel}>Tokens Used:</Text>
                <Text style={styles.statusValue}>
                  {(aiSettings?.totalTokensUsed || 0).toLocaleString()}
                </Text>
              </View>
            </>
          )}
        </View>

        {/* What is Gemini? Button */}
        <TouchableOpacity style={styles.infoButton} onPress={handleShowExplainer}>
          <MaterialCommunityIcons
            name="help-circle"
            size={24}
            color={colors.primary.main}
          />
          <Text style={styles.infoButtonText}>What is Gemini?</Text>
          <MaterialCommunityIcons
            name="chevron-right"
            size={20}
            color={themeColors.textSecondary}
          />
        </TouchableOpacity>

        {/* Get Free API Key Button */}
        <TouchableOpacity style={styles.getKeyButton} onPress={handleGetAPIKey}>
          <MaterialCommunityIcons name="key-variant" size={20} color="#fff" />
          <View style={styles.getKeyContent}>
            <Text style={styles.getKeyText}>Get Free API Key</Text>
            <Text style={styles.getKeySubtext}>Opens Google AI Studio (30 seconds)</Text>
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
              placeholder="Paste your API key here"
              placeholderTextColor={themeColors.textSecondary}
              secureTextEntry={false}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={styles.eyeButton}
              onPress={handleToggleShowKey}
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

        {/* Test Connection Button */}
        <TouchableOpacity
          style={styles.testButton}
          onPress={handleTestConnection}
          disabled={isValidating || !apiKey}
        >
          {isValidating ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <MaterialCommunityIcons name="connection" size={20} color="#fff" />
              <Text style={styles.testButtonText}>Test Connection</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Model Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>AI Model</Text>
          <Text style={styles.sectionHint}>
            Choose the model that best fits your needs
          </Text>
          
          {GEMINI_MODELS.map((model) => (
            <TouchableOpacity
              key={model.id}
              style={[
                styles.modelCard,
                aiSettings?.selectedModel === model.id && styles.modelCardActive,
              ]}
              onPress={() => handleSelectModel(model.id)}
            >
              <View style={styles.modelCardContent}>
                <View style={styles.modelHeader}>
                  <Text style={styles.modelName}>{model.name}</Text>
                  {model.recommended && (
                    <View style={styles.recommendedBadge}>
                      <MaterialCommunityIcons name="star" size={12} color="#fff" />
                      <Text style={styles.recommendedText}>Recommended</Text>
                    </View>
                  )}
                </View>
                
                <Text style={styles.modelDescription}>{model.description}</Text>
                
                <View style={styles.modelStats}>
                  <View style={styles.statRow}>
                    <MaterialCommunityIcons
                      name="lightning-bolt"
                      size={16}
                      color={themeColors.textSecondary}
                    />
                    <Text style={styles.statText}>Speed: </Text>
                    <Text style={styles.statValue}>{'⚡'.repeat(model.speed)}</Text>
                  </View>
                  <View style={styles.statRow}>
                    <MaterialCommunityIcons
                      name="star"
                      size={16}
                      color={themeColors.textSecondary}
                    />
                    <Text style={styles.statText}>Accuracy: </Text>
                    <Text style={styles.statValue}>{'⭐'.repeat(model.accuracy)}</Text>
                  </View>
                </View>
                
                <Text style={styles.modelBestFor}>Best for: {model.bestFor}</Text>
              </View>
              
              {aiSettings?.selectedModel === model.id && (
                <MaterialCommunityIcons
                  name="check-circle"
                  size={24}
                  color={colors.success.main}
                  style={styles.selectedIcon}
                />
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={[styles.saveButton, !hasChanges && !apiKey && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={!hasChanges && !apiKey}
          >
            <MaterialCommunityIcons name="check" size={20} color="#fff" />
            <Text style={styles.saveButtonText}>Save Settings</Text>
          </TouchableOpacity>

          {aiSettings?.isConfigured && (
            <TouchableOpacity style={styles.clearButton} onPress={handleClearKey}>
              <MaterialCommunityIcons
                name="delete"
                size={20}
                color={colors.error.main}
              />
              <Text style={styles.clearButtonText}>Clear API Key</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* Explainer Modal */}
      <GeminiExplainerModal
        visible={showExplainer}
        onClose={() => setShowExplainer(false)}
        onGetStarted={() => {
          setShowExplainer(false);
          // Focus could be added here in the future
        }}
      />
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
    },
    freeBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.success.main,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: 12,
      marginBottom: spacing.lg,
      gap: spacing.xs,
    },
    freeBadgeText: {
      ...typography.body,
      color: '#fff',
      fontWeight: '700',
    },
    statusCard: {
      backgroundColor: themeColors.surface,
      padding: spacing.md,
      borderRadius: 12,
      marginBottom: spacing.lg,
      borderWidth: 1,
      borderColor: themeColors.border,
    },
    statusHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.sm,
    },
    statusText: {
      ...typography.h4,
      color: themeColors.text,
      fontWeight: '600',
    },
    statusRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: spacing.xs,
    },
    statusLabel: {
      ...typography.body,
      color: themeColors.textSecondary,
    },
    statusValue: {
      ...typography.body,
      color: themeColors.text,
      fontWeight: '600',
    },
    infoButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: themeColors.surface,
      padding: spacing.md,
      borderRadius: 12,
      marginBottom: spacing.md,
      borderWidth: 1,
      borderColor: colors.primary.main,
      gap: spacing.sm,
    },
    infoButtonText: {
      ...typography.body,
      color: colors.primary.main,
      fontWeight: '600',
      flex: 1,
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
      fontWeight: '600',
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
    sectionHint: {
      ...typography.caption,
      color: themeColors.textSecondary,
      marginTop: spacing.xs,
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
    testButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.info.main,
      padding: spacing.md,
      borderRadius: 12,
      marginBottom: spacing.lg,
      gap: spacing.sm,
    },
    testButtonText: {
      ...typography.body,
      color: '#fff',
      fontWeight: '600',
    },
    modelCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: themeColors.surface,
      padding: spacing.md,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: themeColors.border,
      marginBottom: spacing.md,
    },
    modelCardActive: {
      borderColor: colors.success.main,
      backgroundColor: `${colors.success.main}08`,
    },
    modelCardContent: {
      flex: 1,
    },
    modelHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.xs,
      gap: spacing.sm,
    },
    modelName: {
      ...typography.body,
      color: themeColors.text,
      fontWeight: '700',
    },
    recommendedBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.warning.main,
      paddingHorizontal: spacing.xs,
      paddingVertical: 2,
      borderRadius: 8,
      gap: 2,
    },
    recommendedText: {
      ...typography.caption,
      color: '#fff',
      fontSize: 10,
      fontWeight: '600',
    },
    modelDescription: {
      ...typography.bodySmall,
      color: themeColors.textSecondary,
      marginBottom: spacing.sm,
    },
    modelStats: {
      flexDirection: 'row',
      gap: spacing.md,
      marginBottom: spacing.xs,
    },
    statRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
    },
    statText: {
      ...typography.caption,
      color: themeColors.textSecondary,
    },
    statValue: {
      ...typography.caption,
      color: themeColors.text,
    },
    modelBestFor: {
      ...typography.caption,
      color: themeColors.textSecondary,
      fontStyle: 'italic',
    },
    selectedIcon: {
      marginLeft: spacing.sm,
    },
    actionsContainer: {
      gap: spacing.md,
      marginTop: spacing.md,
    },
    saveButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary.main,
      padding: spacing.md,
      borderRadius: 12,
      gap: spacing.sm,
    },
    saveButtonDisabled: {
      opacity: 0.5,
    },
    saveButtonText: {
      ...typography.body,
      color: '#fff',
      fontWeight: '600',
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
