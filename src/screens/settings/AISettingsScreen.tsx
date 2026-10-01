/**
 * Purpose: Configure AI Assistant settings: Laya System-1 fast router,
 * Multi-Provider setup (Groq SLMs, Google Gemini, Local Ollama/Custom).
 *
 * Airy Minimalist Bento design with high contrast controls.
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
  Switch,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSettingsStore } from '../../store/settingsStore';
import { spacing, borderRadius } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { useThemeColors } from '../../hooks/useThemeColors';
import { lightHaptic, mediumHaptic } from '../../services/haptics/hapticFeedback';
import {
  PROVIDER_LABELS,
  PROVIDER_MODELS,
  GROQ_API_URL,
} from '../../constants/aiProviders';
import type { AIProvider } from '../../types/ai';

const GROQ_CONSOLE_URL = 'https://console.groq.com/keys';
const GEMINI_STUDIO_URL = 'https://aistudio.google.com/app/apikey';

export default function AISettingsScreen({ navigation }: any) {
  const store = useSettingsStore();
  const aiSettings = store.aiSettings;
  const updateAISettings = store.updateAISettings;
  const themeColors = useThemeColors();

  // State
  const [provider, setProvider] = useState<AIProvider>(aiSettings?.provider || 'groq');
  const [system1Enabled, setSystem1Enabled] = useState<boolean>(aiSettings?.system1Enabled ?? true);

  // Keys per provider
  const [geminiKey, setGeminiKey] = useState<string>(
    aiSettings?.geminiApiKey || (aiSettings?.provider === 'gemini' ? aiSettings?.apiKey || '' : '')
  );
  const [groqKey, setGroqKey] = useState<string>(
    aiSettings?.groqApiKey || (aiSettings?.provider === 'groq' ? aiSettings?.apiKey || '' : '')
  );
  const [customKey, setCustomKey] = useState<string>(aiSettings?.customApiKey || '');
  const [customBaseUrl, setCustomBaseUrl] = useState<string>(
    aiSettings?.customBaseUrl || 'http://localhost:11434/v1'
  );
  const [selectedModel, setSelectedModel] = useState<string>(
    aiSettings?.selectedModel || (provider === 'groq' ? 'llama-3.2-3b-preview' : 'gemini-2.5-flash')
  );

  const [showKey, setShowKey] = useState<boolean>(false);
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [hasChanges, setHasChanges] = useState<boolean>(false);

  const styles = useMemo(() => createStyles(themeColors), [themeColors]);

  const activeKey = provider === 'gemini' ? geminiKey : provider === 'groq' ? groqKey : customKey;

  const handleProviderSelect = (p: AIProvider) => {
    lightHaptic();
    setProvider(p);
    setHasChanges(true);
    // select default model for provider
    const models = PROVIDER_MODELS[p];
    if (models && models.length > 0) {
      setSelectedModel(models.find((m) => m.recommended)?.id || models[0].id);
    }
  };

  const handleGetAPIKey = useCallback(async () => {
    mediumHaptic();
    const url = provider === 'groq' ? GROQ_CONSOLE_URL : GEMINI_STUDIO_URL;
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
    } else {
      Alert.alert('Cannot open link', `Copy into browser:\n${url}`);
    }
  }, [provider]);

  // Live test connection
  const handleTestConnection = useCallback(async () => {
    mediumHaptic();
    setIsValidating(true);

    try {
      if (provider === 'groq') {
        if (!groqKey || groqKey.trim().length === 0) {
          Alert.alert('Key Required', 'Please enter your Groq API key first.');
          return;
        }

        const res = await fetch(GROQ_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${groqKey.trim()}`,
          },
          body: JSON.stringify({
            model: selectedModel || 'llama-3.2-3b-preview',
            messages: [{ role: 'user', content: 'ping' }],
            max_tokens: 5,
          }),
        });

        if (res.ok) {
          Alert.alert('Success!', 'Connected to Groq Cloud successfully with Llama 3.2.');
        } else {
          const err = await res.json();
          Alert.alert('Connection Failed', err.error?.message || 'Check your Groq key.');
        }
      } else if (provider === 'gemini') {
        if (!geminiKey || geminiKey.trim().length === 0) {
          Alert.alert('Key Required', 'Please enter your Google Gemini API key first.');
          return;
        }

        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${geminiKey.trim()}`,
          { method: 'GET' }
        );

        if (res.ok) {
          Alert.alert('Success!', 'Connected to Google Gemini successfully.');
        } else {
          const err = await res.json();
          Alert.alert('Connection Failed', err.error?.message || 'Check your Gemini key.');
        }
      } else {
        // Custom OpenAI endpoint
        let endpoint = customBaseUrl.trim();
        if (!endpoint.endsWith('/chat/completions')) {
          endpoint = endpoint.replace(/\/+$/, '') + '/chat/completions';
        }

        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (customKey && customKey.trim().length > 0) {
          headers.Authorization = `Bearer ${customKey.trim()}`;
        }

        const res = await fetch(endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model: selectedModel || 'smollm2:1.7b',
            messages: [{ role: 'user', content: 'ping' }],
            max_tokens: 5,
          }),
        });

        if (res.ok) {
          Alert.alert('Success!', 'Connected to local/custom OpenAI endpoint successfully.');
        } else {
          Alert.alert('Connection Failed', `Status ${res.status}. Verify endpoint URL and model.`);
        }
      }
    } catch (error: any) {
      Alert.alert(
        'Connection Error',
        `Could not reach endpoint: ${error.message || 'Please check network connection.'}`
      );
    } finally {
      setIsValidating(false);
    }
  }, [provider, groqKey, geminiKey, customKey, customBaseUrl, selectedModel]);

  // Save settings
  const handleSave = () => {
    mediumHaptic();

    const activeApiKey =
      provider === 'groq' ? groqKey : provider === 'gemini' ? geminiKey : customKey;

    updateAISettings({
      provider,
      system1Enabled,
      apiKey: activeApiKey,
      groqApiKey: groqKey,
      geminiApiKey: geminiKey,
      customApiKey: customKey,
      customBaseUrl,
      selectedModel,
      isConfigured: provider === 'custom_openai' ? true : Boolean(activeApiKey && activeApiKey.length > 0),
    });

    setHasChanges(false);
    Alert.alert('Saved', 'AI Assistant preferences updated.');
  };

  const availableModels = PROVIDER_MODELS[provider] || [];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Laya System-1 Fast Engine Card */}
      <View style={styles.bentoCard}>
        <View style={styles.cardHeader}>
          <View style={[styles.iconCircle, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
            <MaterialCommunityIcons name="lightning-bolt" size={24} color="#F59E0B" />
          </View>
          <View style={styles.headerTitleCol}>
            <Text style={styles.cardTitle}>Laya System-1 Engine</Text>
            <Text style={styles.cardBadgeText}>Non-Autoregressive • On-Device</Text>
          </View>
          <Switch
            value={system1Enabled}
            onValueChange={(val) => {
              lightHaptic();
              setSystem1Enabled(val);
              setHasChanges(true);
            }}
            trackColor={{ false: themeColors.border, true: themeColors.primary }}
            thumbColor={system1Enabled ? themeColors.onPrimary : themeColors.textMuted}
          />
        </View>

        <Text style={styles.cardBodyText}>
          Routes routine operations (logging transactions, checking balances, and viewing summaries)
          in <Text style={styles.boldText}>&lt;20ms</Text> directly on your phone with zero token usage.
          Complex questions seamlessly pass to System-2.
        </Text>
      </View>

      {/* Provider Selector Card */}
      <View style={styles.bentoCard}>
        <Text style={styles.sectionHeading}>SYSTEM-2 PROVIDER</Text>
        <Text style={styles.sectionSubtitle}>
          Choose the intelligence engine for deep reasoning and budgeting advice
        </Text>

        <View style={styles.providerGrid}>
          {(['groq', 'gemini', 'custom_openai'] as AIProvider[]).map((p) => {
            const isSelected = provider === p;
            const meta = PROVIDER_LABELS[p];
            return (
              <TouchableOpacity
                key={p}
                style={[styles.providerTile, isSelected && styles.providerTileSelected]}
                onPress={() => handleProviderSelect(p)}
                activeOpacity={0.8}
              >
                <View style={styles.tileHeader}>
                  <MaterialCommunityIcons
                    name={meta.icon as any}
                    size={22}
                    color={isSelected ? themeColors.primary : themeColors.textSecondary}
                  />
                  {isSelected && (
                    <MaterialCommunityIcons name="check-circle" size={18} color={themeColors.primary} />
                  )}
                </View>
                <Text style={[styles.providerTitle, isSelected && styles.providerTitleSelected]}>
                  {meta.name}
                </Text>
                <Text style={styles.providerDesc} numberOfLines={2}>
                  {meta.subtitle}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Provider Configuration Card */}
      <View style={styles.bentoCard}>
        <Text style={styles.sectionHeading}>CREDENTIALS & MODEL</Text>

        {provider !== 'custom_openai' ? (
          <>
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>
                {provider === 'groq' ? 'Groq API Key' : 'Gemini API Key'}
              </Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.textInput}
                  value={provider === 'groq' ? groqKey : geminiKey}
                  onChangeText={(val) => {
                    if (provider === 'groq') setGroqKey(val.trim());
                    else setGeminiKey(val.trim());
                    setHasChanges(true);
                  }}
                  placeholder={`Paste your ${provider === 'groq' ? 'gsk_...' : 'AIza...'} key`}
                  placeholderTextColor={themeColors.textMuted}
                  secureTextEntry={!showKey}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  onPress={() => setShowKey(!showKey)}
                  style={styles.inputIconBtn}
                  hitSlop={8}
                >
                  <MaterialCommunityIcons
                    name={showKey ? 'eye-off' : 'eye'}
                    size={20}
                    color={themeColors.textSecondary}
                  />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={styles.getKeyBtn}
              onPress={handleGetAPIKey}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name="open-in-new" size={16} color={themeColors.primary} />
              <Text style={styles.getKeyBtnText}>
                Get free key from {provider === 'groq' ? 'Groq Console' : 'Google AI Studio'}
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Local / Endpoint Base URL</Text>
              <TextInput
                style={[styles.textInput, styles.singleLineInput]}
                value={customBaseUrl}
                onChangeText={(val) => {
                  setCustomBaseUrl(val.trim());
                  setHasChanges(true);
                }}
                placeholder="http://192.168.1.100:11434/v1"
                placeholderTextColor={themeColors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Endpoint API Key (Optional)</Text>
              <TextInput
                style={[styles.textInput, styles.singleLineInput]}
                value={customKey}
                onChangeText={(val) => {
                  setCustomKey(val.trim());
                  setHasChanges(true);
                }}
                placeholder="Optional Bearer token"
                placeholderTextColor={themeColors.textMuted}
                secureTextEntry={!showKey}
                autoCapitalize="none"
              />
            </View>
          </>
        )}

        {/* Model Picker */}
        <Text style={[styles.inputLabel, { marginTop: 14 }]}>Selected Model</Text>
        <View style={styles.modelList}>
          {availableModels.map((m) => {
            const isSelected = selectedModel === m.id;
            return (
              <TouchableOpacity
                key={m.id}
                style={[styles.modelRow, isSelected && styles.modelRowSelected]}
                onPress={() => {
                  lightHaptic();
                  setSelectedModel(m.id);
                  setHasChanges(true);
                }}
                activeOpacity={0.75}
              >
                <View style={styles.modelRowLeft}>
                  <Text style={[styles.modelName, isSelected && styles.modelNameSelected]}>
                    {m.name}
                  </Text>
                  <Text style={styles.modelDesc}>{m.description}</Text>
                </View>
                {isSelected && (
                  <MaterialCommunityIcons name="check" size={20} color={themeColors.primary} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Test Connection Button */}
        <TouchableOpacity
          style={styles.testBtn}
          onPress={handleTestConnection}
          disabled={isValidating}
          activeOpacity={0.75}
        >
          {isValidating ? (
            <ActivityIndicator size="small" color={themeColors.primary} />
          ) : (
            <>
              <MaterialCommunityIcons name="connection" size={18} color={themeColors.primary} />
              <Text style={styles.testBtnText}>Test Connection</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Save Button */}
      <TouchableOpacity
        style={[styles.saveBtn, !hasChanges && styles.saveBtnMuted]}
        onPress={handleSave}
        activeOpacity={0.8}
      >
        <MaterialCommunityIcons name="content-save-outline" size={20} color={themeColors.onPrimary} />
        <Text style={styles.saveBtnText}>Save Preferences</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const createStyles = (themeColors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: themeColors.background,
    },
    content: {
      padding: spacing.lg,
      paddingBottom: 60,
      gap: 16,
    },
    bentoCard: {
      backgroundColor: themeColors.surface,
      borderRadius: 24,
      padding: 20,
      borderWidth: 1,
      borderColor: themeColors.cardBorder,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 3,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
    },
    iconCircle: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    headerTitleCol: {
      flex: 1,
    },
    cardTitle: {
      ...typography.h3,
      color: themeColors.text,
      fontWeight: '700',
      marginBottom: 2,
    },
    cardBadgeText: {
      ...typography.caption,
      color: themeColors.textMuted,
      fontWeight: '600',
    },
    cardBodyText: {
      ...typography.bodySmall,
      color: themeColors.textSecondary,
      lineHeight: 20,
    },
    boldText: {
      fontWeight: '700',
      color: themeColors.text,
    },
    sectionHeading: {
      ...typography.caption,
      color: themeColors.textMuted,
      fontWeight: '800',
      letterSpacing: 0.8,
      marginBottom: 4,
    },
    sectionSubtitle: {
      ...typography.bodySmall,
      color: themeColors.textSecondary,
      marginBottom: 16,
    },
    providerGrid: {
      gap: 10,
    },
    providerTile: {
      backgroundColor: themeColors.surfaceHighlight,
      borderRadius: 16,
      padding: 14,
      borderWidth: 1.5,
      borderColor: themeColors.cardBorder,
    },
    providerTileSelected: {
      borderColor: themeColors.primary,
      backgroundColor: `${themeColors.primary}12`,
    },
    tileHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 6,
    },
    providerTitle: {
      ...typography.body,
      fontWeight: '700',
      color: themeColors.text,
      marginBottom: 2,
    },
    providerTitleSelected: {
      color: themeColors.primary,
    },
    providerDesc: {
      ...typography.caption,
      color: themeColors.textMuted,
      lineHeight: 16,
    },
    inputContainer: {
      marginTop: 12,
    },
    inputLabel: {
      ...typography.caption,
      color: themeColors.textSecondary,
      fontWeight: '700',
      marginBottom: 6,
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: themeColors.surfaceHighlight,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: themeColors.cardBorder,
      paddingHorizontal: 12,
    },
    singleLineInput: {
      backgroundColor: themeColors.surfaceHighlight,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: themeColors.cardBorder,
      paddingHorizontal: 14,
      paddingVertical: 10,
      color: themeColors.text,
    },
    textInput: {
      flex: 1,
      paddingVertical: 10,
      ...typography.body,
      color: themeColors.text,
    },
    inputIconBtn: {
      padding: 6,
    },
    getKeyBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      alignSelf: 'flex-start',
      marginTop: 8,
      paddingVertical: 4,
    },
    getKeyBtnText: {
      ...typography.caption,
      color: themeColors.primary,
      fontWeight: '700',
    },
    modelList: {
      marginTop: 8,
      gap: 8,
    },
    modelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 12,
      borderRadius: 14,
      backgroundColor: themeColors.surfaceHighlight,
      borderWidth: 1,
      borderColor: themeColors.cardBorder,
    },
    modelRowSelected: {
      borderColor: themeColors.primary,
      backgroundColor: `${themeColors.primary}12`,
    },
    modelRowLeft: {
      flex: 1,
      paddingRight: 8,
    },
    modelName: {
      ...typography.bodySmall,
      fontWeight: '700',
      color: themeColors.text,
      marginBottom: 2,
    },
    modelNameSelected: {
      color: themeColors.primary,
    },
    modelDesc: {
      ...typography.caption,
      color: themeColors.textMuted,
      lineHeight: 16,
    },
    testBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 12,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: themeColors.primary,
      marginTop: 16,
    },
    testBtnText: {
      ...typography.bodySmall,
      color: themeColors.primary,
      fontWeight: '700',
    },
    saveBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: themeColors.primary,
      paddingVertical: 16,
      borderRadius: borderRadius.round,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 4,
    },
    saveBtnMuted: {
      opacity: 0.85,
    },
    saveBtnText: {
      ...typography.body,
      color: themeColors.onPrimary,
      fontWeight: '700',
    },
  });
