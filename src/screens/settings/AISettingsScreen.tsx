/**
 * AISettingsScreen — Simplizum Multi-Provider Architectural Deck
 *
 * Disciplined, sparse, hairline-bordered AI engine configuration:
 *  - System-1 Laya Sub-20ms Router toggle
 *  - Multi-Provider architectural deck (Google Gemini, Groq SLM, Local Ollama)
 *  - Foundation model matrix with latency & capability specs
 *  - Secure masked API credential storage
 *  - Real-time connectivity benchmark with millisecond latency ping
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
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { useThemeColors } from '../../hooks/useThemeColors';
import { lightHaptic, mediumHaptic, heavyHaptic, errorHaptic } from '../../services/haptics/hapticFeedback';
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
  const [provider, setProvider] = useState<AIProvider>(aiSettings?.provider || 'gemini');
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
  const [latencyResult, setLatencyResult] = useState<number | null>(null);
  const [hasChanges, setHasChanges] = useState<boolean>(false);

  const styles = useMemo(() => createStyles(themeColors), [themeColors]);

  const handleProviderSelect = (p: AIProvider) => {
    lightHaptic();
    setProvider(p);
    setLatencyResult(null);
    setHasChanges(true);
    const models = PROVIDER_MODELS[p];
    if (models && models.length > 0) {
      setSelectedModel(models.find((m) => m.recommended)?.id || models[0].id);
    }
  };

  const handleGetAPIKey = useCallback(async () => {
    lightHaptic();
    const url = provider === 'groq' ? GROQ_CONSOLE_URL : GEMINI_STUDIO_URL;
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
    } else {
      Alert.alert('Cannot open link', `Direct URL:\n${url}`);
    }
  }, [provider]);

  // Live test connection with latency benchmark
  const handleTestConnection = useCallback(async () => {
    mediumHaptic();
    setIsValidating(true);
    setLatencyResult(null);
    const startTime = Date.now();

    try {
      if (provider === 'groq') {
        if (!groqKey || groqKey.trim().length === 0) {
          errorHaptic();
          Alert.alert('Key Required', 'Please enter your Groq API key.');
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

        const elapsed = Date.now() - startTime;
        if (res.ok) {
          lightHaptic();
          setLatencyResult(elapsed);
          Alert.alert('BENCHMARK PASSED', `Connected to Groq Cloud in ${elapsed}ms.`);
        } else {
          errorHaptic();
          const err = await res.json();
          Alert.alert('Connection Failed', err.error?.message || 'Check your Groq API key.');
        }
      } else if (provider === 'gemini') {
        if (!geminiKey || geminiKey.trim().length === 0) {
          errorHaptic();
          Alert.alert('Key Required', 'Please enter your Google Gemini API key.');
          return;
        }

        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${geminiKey.trim()}`,
          { method: 'GET' }
        );

        const elapsed = Date.now() - startTime;
        if (res.ok) {
          lightHaptic();
          setLatencyResult(elapsed);
          Alert.alert('BENCHMARK PASSED', `Connected to Google Gemini in ${elapsed}ms.`);
        } else {
          errorHaptic();
          const err = await res.json();
          Alert.alert('Connection Failed', err.error?.message || 'Check your Gemini key.');
        }
      } else {
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

        const elapsed = Date.now() - startTime;
        if (res.ok) {
          lightHaptic();
          setLatencyResult(elapsed);
          Alert.alert('BENCHMARK PASSED', `Connected to Local Endpoint in ${elapsed}ms.`);
        } else {
          errorHaptic();
          Alert.alert('Connection Failed', `Status ${res.status}. Verify endpoint URL and model.`);
        }
      }
    } catch (error: any) {
      errorHaptic();
      Alert.alert(
        'Connection Error',
        `Could not reach endpoint: ${error.message || 'Please check network connection.'}`
      );
    } finally {
      setIsValidating(false);
    }
  }, [provider, groqKey, geminiKey, customKey, customBaseUrl, selectedModel]);

  const handleSave = () => {
    heavyHaptic();
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
    Alert.alert('CONFIGURED', 'AI Assistant preferences updated.');
  };

  const availableModels = PROVIDER_MODELS[provider] || [];

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            lightHaptic();
            navigation.goBack();
          }}
        >
          <MaterialCommunityIcons name="arrow-left" size={20} color={themeColors.text} />
        </TouchableOpacity>
        <View style={styles.headerTitles}>
          <Text style={styles.headerSuper}>INTELLIGENCE ENGINE</Text>
          <Text style={styles.headerTitle}>AI & LAYA CONFIG</Text>
        </View>
        <View style={styles.statusPill}>
          <Text style={styles.statusText}>{provider.toUpperCase()}</Text>
        </View>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* CARD 1: LAYA SYSTEM-1 FAST ROUTER */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardHeaderTitle}>LAYA SYSTEM-1 HYPER-ROUTER</Text>
          </View>
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Text style={styles.rowLabel}>Non-Autoregressive Fast Path</Text>
              <Text style={styles.rowDesc}>
                Executes balance queries & transaction logging in &lt;20ms with 0 token overhead
              </Text>
            </View>
            <Switch
              value={system1Enabled}
              onValueChange={(val) => {
                lightHaptic();
                setSystem1Enabled(val);
                setHasChanges(true);
              }}
              trackColor={{ false: themeColors.border, true: themeColors.text }}
              thumbColor={themeColors.background}
            />
          </View>
        </View>

        {/* CARD 2: MULTI-PROVIDER ARCHITECTURAL DECK */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardHeaderTitle}>FOUNDATION PROVIDER DECK</Text>
          </View>
          <View style={styles.providerRow}>
            {(['gemini', 'groq', 'custom_openai'] as AIProvider[]).map((p) => {
              const isSelected = provider === p;
              const meta = PROVIDER_LABELS[p];
              return (
                <TouchableOpacity
                  key={p}
                  style={[styles.providerTab, isSelected ? styles.providerTabActive : null]}
                  onPress={() => handleProviderSelect(p)}
                >
                  <Text style={[styles.providerTabTitle, isSelected ? styles.providerTabTitleActive : null]}>
                    {meta.name.toUpperCase()}
                  </Text>
                  <Text style={[styles.providerTabSub, isSelected ? styles.providerTabSubActive : null]}>
                    {p === 'gemini' ? 'Multimodal' : p === 'groq' ? 'Ultra-Fast' : 'Self-Hosted'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* CARD 3: CREDENTIALS & SECURITY VAULT */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardHeaderTitle}>CREDENTIALS & SECURITY</Text>
          </View>

          {provider !== 'custom_openai' ? (
            <View style={styles.cardBody}>
              <Text style={styles.fieldLabel}>
                {provider === 'groq' ? 'GROQ API KEY' : 'GOOGLE GEMINI API KEY'}
              </Text>
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.keyInput}
                  value={provider === 'groq' ? groqKey : geminiKey}
                  onChangeText={(val) => {
                    if (provider === 'groq') setGroqKey(val.trim());
                    else setGeminiKey(val.trim());
                    setHasChanges(true);
                  }}
                  placeholder={`Paste ${provider === 'groq' ? 'gsk_...' : 'AIza...'} key`}
                  placeholderTextColor={themeColors.textSecondary}
                  secureTextEntry={!showKey}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  style={styles.eyeBtn}
                  onPress={() => setShowKey(!showKey)}
                  hitSlop={8}
                >
                  <MaterialCommunityIcons
                    name={showKey ? 'eye-off' : 'eye'}
                    size={18}
                    color={themeColors.textSecondary}
                  />
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.linkRow} onPress={handleGetAPIKey}>
                <MaterialCommunityIcons name="open-in-new" size={14} color={themeColors.text} />
                <Text style={styles.linkText}>
                  Get free key from {provider === 'groq' ? 'Groq Console' : 'Google AI Studio'}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.cardBody}>
              <Text style={styles.fieldLabel}>LOCAL ENDPOINT BASE URL</Text>
              <TextInput
                style={styles.plainInput}
                value={customBaseUrl}
                onChangeText={(val) => {
                  setCustomBaseUrl(val.trim());
                  setHasChanges(true);
                }}
                placeholder="http://192.168.1.100:11434/v1"
                placeholderTextColor={themeColors.textSecondary}
                autoCapitalize="none"
                autoCorrect={false}
              />

              <Text style={[styles.fieldLabel, { marginTop: spacing.md }]}>BEARER TOKEN (OPTIONAL)</Text>
              <TextInput
                style={styles.plainInput}
                value={customKey}
                onChangeText={(val) => {
                  setCustomKey(val.trim());
                  setHasChanges(true);
                }}
                placeholder="Authorization header token"
                placeholderTextColor={themeColors.textSecondary}
                secureTextEntry={!showKey}
                autoCapitalize="none"
              />
            </View>
          )}
        </View>

        {/* CARD 4: FOUNDATION MODEL MATRIX */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardHeaderTitle}>FOUNDATION MODEL MATRIX</Text>
          </View>
          {availableModels.map((m, idx) => {
            const isSelected = selectedModel === m.id;
            return (
              <React.Fragment key={m.id}>
                {idx > 0 && <View style={styles.divider} />}
                <TouchableOpacity
                  style={[styles.modelRow, isSelected ? styles.modelRowActive : null]}
                  onPress={() => {
                    lightHaptic();
                    setSelectedModel(m.id);
                    setHasChanges(true);
                  }}
                >
                  <View style={styles.modelLeft}>
                    <View style={styles.modelNameRow}>
                      <Text style={[styles.modelName, isSelected ? styles.modelNameActive : null]}>
                        {m.name}
                      </Text>
                      {m.recommended && (
                        <View style={styles.recBadge}>
                          <Text style={styles.recBadgeText}>RECOMMENDED</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.modelDesc}>{m.description}</Text>
                  </View>
                  <View style={styles.modelRight}>
                    {isSelected ? (
                      <View style={styles.checkPill}>
                        <Text style={styles.checkPillText}>SELECTED</Text>
                      </View>
                    ) : (
                      <Text style={styles.selectText}>SELECT</Text>
                    )}
                  </View>
                </TouchableOpacity>
              </React.Fragment>
            );
          })}
        </View>

        {/* CARD 5: LATENCY BENCHMARK & TEST */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardHeaderTitle}>CONNECTIVITY & LATENCY BENCHMARK</Text>
          </View>
          <View style={styles.benchmarkBody}>
            <View style={styles.benchmarkMeta}>
              <Text style={styles.benchmarkLabel}>ENDPOINT LATENCY:</Text>
              <Text style={styles.benchmarkValue}>
                {latencyResult !== null ? `${latencyResult} ms` : 'NOT TESTED'}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.pingButton}
              onPress={handleTestConnection}
              disabled={isValidating}
            >
              {isValidating ? (
                <ActivityIndicator size="small" color={themeColors.text} />
              ) : (
                <>
                  <MaterialCommunityIcons name="speedometer" size={16} color={themeColors.text} />
                  <Text style={styles.pingButtonText}>RUN LIVE LATENCY BENCHMARK</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* BOTTOM SAVE BUTTON */}
        <TouchableOpacity
          style={[styles.saveButton, !hasChanges ? styles.saveButtonMuted : null]}
          onPress={handleSave}
        >
          <Text style={styles.saveButtonText}>SAVE ARCHITECTURAL PREFERENCES</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingTop: spacing.xl,
      paddingBottom: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.hairline || theme.border,
      gap: spacing.sm,
    },
    backButton: {
      width: 36,
      height: 36,
      borderWidth: 1,
      borderColor: theme.hairline || theme.border,
      borderRadius: 2,
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerTitles: {
      flex: 1,
    },
    headerSuper: {
      ...typography.caption,
      color: theme.textSecondary,
      fontSize: 10,
      letterSpacing: 1.5,
      fontWeight: '700',
    },
    headerTitle: {
      ...typography.h3,
      color: theme.text,
      letterSpacing: 0.5,
      fontWeight: '700',
    },
    statusPill: {
      borderWidth: 1,
      borderColor: theme.hairline || theme.border,
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
      borderRadius: 2,
    },
    statusText: {
      ...typography.caption,
      color: theme.text,
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 0.8,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      padding: spacing.md,
      paddingBottom: spacing.xxl + 40,
    },
    card: {
      borderWidth: 1,
      borderColor: theme.hairline || theme.border,
      backgroundColor: theme.card || theme.surface,
      borderRadius: 2,
      marginBottom: spacing.md,
      overflow: 'hidden',
    },
    cardHeader: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: theme.hairline || theme.border,
      backgroundColor: theme.background,
    },
    cardHeaderTitle: {
      ...typography.caption,
      color: theme.textSecondary,
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 1.2,
    },
    cardBody: {
      padding: spacing.md,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
    },
    rowLeft: {
      flex: 1,
      marginRight: spacing.md,
    },
    rowLabel: {
      ...typography.body,
      color: theme.text,
      fontWeight: '600',
      fontSize: 14,
      marginBottom: 2,
    },
    rowDesc: {
      ...typography.caption,
      color: theme.textSecondary,
      fontSize: 12,
      lineHeight: 16,
    },
    providerRow: {
      flexDirection: 'row',
    },
    providerTab: {
      flex: 1,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xs,
      alignItems: 'center',
      borderRightWidth: 1,
      borderRightColor: theme.hairline || theme.border,
      backgroundColor: theme.background,
    },
    providerTabActive: {
      backgroundColor: theme.text,
    },
    providerTabTitle: {
      ...typography.caption,
      color: theme.text,
      fontWeight: '700',
      fontSize: 11,
      letterSpacing: 0.5,
    },
    providerTabTitleActive: {
      color: theme.background,
    },
    providerTabSub: {
      ...typography.caption,
      color: theme.textSecondary,
      fontSize: 9,
      marginTop: 2,
    },
    providerTabSubActive: {
      color: theme.background,
      opacity: 0.8,
    },
    fieldLabel: {
      ...typography.caption,
      color: theme.textSecondary,
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 1,
      marginBottom: spacing.xs,
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.hairline || theme.border,
      backgroundColor: theme.background,
      borderRadius: 2,
      paddingHorizontal: spacing.sm,
    },
    keyInput: {
      flex: 1,
      paddingVertical: spacing.sm,
      fontFamily: 'monospace',
      fontSize: 13,
      color: theme.text,
    },
    plainInput: {
      borderWidth: 1,
      borderColor: theme.hairline || theme.border,
      backgroundColor: theme.background,
      borderRadius: 2,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      fontFamily: 'monospace',
      fontSize: 13,
      color: theme.text,
    },
    eyeBtn: {
      padding: spacing.xs,
    },
    linkRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: spacing.sm,
    },
    linkText: {
      ...typography.caption,
      color: theme.text,
      fontSize: 11,
      fontWeight: '600',
      textDecorationLine: 'underline',
    },
    divider: {
      height: 1,
      backgroundColor: theme.hairline || theme.border,
      marginLeft: spacing.md,
    },
    modelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 4,
    },
    modelRowActive: {
      backgroundColor: theme.background,
    },
    modelLeft: {
      flex: 1,
      marginRight: spacing.md,
    },
    modelNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      marginBottom: 2,
    },
    modelName: {
      ...typography.body,
      color: theme.text,
      fontSize: 13,
      fontWeight: '600',
    },
    modelNameActive: {
      fontWeight: '700',
    },
    recBadge: {
      borderWidth: 1,
      borderColor: theme.hairline || theme.border,
      paddingHorizontal: 4,
      paddingVertical: 1,
      borderRadius: 2,
    },
    recBadgeText: {
      ...typography.caption,
      fontSize: 8,
      fontWeight: '700',
      letterSpacing: 0.5,
      color: theme.textSecondary,
    },
    modelDesc: {
      ...typography.caption,
      color: theme.textSecondary,
      fontSize: 11,
    },
    modelRight: {
      alignItems: 'flex-end',
    },
    checkPill: {
      borderWidth: 1,
      borderColor: theme.text,
      backgroundColor: theme.text,
      paddingHorizontal: spacing.xs + 2,
      paddingVertical: 2,
      borderRadius: 2,
    },
    checkPillText: {
      ...typography.caption,
      color: theme.background,
      fontSize: 9,
      fontWeight: '700',
      letterSpacing: 0.5,
    },
    selectText: {
      ...typography.caption,
      color: theme.textSecondary,
      fontSize: 10,
      fontWeight: '600',
      letterSpacing: 0.5,
    },
    benchmarkBody: {
      padding: spacing.md,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    benchmarkMeta: {
      flex: 1,
    },
    benchmarkLabel: {
      ...typography.caption,
      color: theme.textSecondary,
      fontSize: 10,
      letterSpacing: 1,
      fontWeight: '700',
    },
    benchmarkValue: {
      ...typography.caption,
      color: theme.text,
      fontSize: 14,
      fontWeight: '700',
      fontFamily: 'monospace',
      marginTop: 2,
    },
    pingButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderWidth: 1,
      borderColor: theme.hairline || theme.border,
      borderRadius: 2,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.sm,
      backgroundColor: theme.background,
    },
    pingButtonText: {
      ...typography.caption,
      color: theme.text,
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 0.5,
    },
    saveButton: {
      borderWidth: 1,
      borderColor: theme.text,
      backgroundColor: theme.text,
      paddingVertical: spacing.md,
      borderRadius: 2,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: spacing.xs,
    },
    saveButtonMuted: {
      opacity: 0.4,
    },
    saveButtonText: {
      ...typography.caption,
      color: theme.background,
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 1.2,
    },
  });
