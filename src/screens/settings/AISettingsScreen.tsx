/**
 * AISettingsScreen — Multi-Provider Intelligence Engine & Architectural Deck
 *
 * Disciplined, sparse, hairline-bordered AI engine configuration:
 *  - System-1 Laya Sub-20ms Hyper-Router toggle
 *  - Multi-Provider architectural deck (Google Gemini, Groq Cloud, OpenRouter, Local SLM / Custom)
 *  - Provider portal links, API keys, and official documentation gateways
 *  - 1-tap local endpoint presets (Ollama Local, Ollama Android Host 10.0.2.2, LM Studio, OpenAI)
 *  - Foundation model matrix with curated specs & live REST discovery
 *  - Real-time connectivity benchmark with millisecond latency ping
 */

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
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
  Platform,
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
  PROVIDER_PORTAL_LINKS,
  LOCAL_ENDPOINT_PRESETS,
  GROQ_API_URL,
  OPENROUTER_API_URL,
} from '../../constants/aiProviders';
import type { AIProvider } from '../../types/ai';

export default function AISettingsScreen({ navigation }: any) {
  const store = useSettingsStore();
  const aiSettings = store.aiSettings;
  const updateAISettings = store.updateAISettings;
  const themeColors = useThemeColors();

  // Active Provider & Laya System-1 toggle
  const [provider, setProvider] = useState<AIProvider>(aiSettings?.provider || 'gemini');
  const [system1Enabled, setSystem1Enabled] = useState<boolean>(aiSettings?.system1Enabled ?? true);

  // Credentials per provider
  const [geminiKey, setGeminiKey] = useState<string>(
    aiSettings?.geminiApiKey || (aiSettings?.provider === 'gemini' ? aiSettings?.apiKey || '' : '')
  );
  const [groqKey, setGroqKey] = useState<string>(
    aiSettings?.groqApiKey || (aiSettings?.provider === 'groq' ? aiSettings?.apiKey || '' : '')
  );
  const [openrouterKey, setOpenrouterKey] = useState<string>(
    aiSettings?.openrouterApiKey || ''
  );
  const [customKey, setCustomKey] = useState<string>(aiSettings?.customApiKey || '');
  const [customBaseUrl, setCustomBaseUrl] = useState<string>(
    aiSettings?.customBaseUrl || 'http://localhost:11434/v1'
  );

  const [selectedModel, setSelectedModel] = useState<string>(
    aiSettings?.selectedModel ||
      (provider === 'groq'
        ? 'llama-3.3-70b-versatile'
        : provider === 'openrouter'
        ? 'deepseek/deepseek-r1'
        : provider === 'custom_openai'
        ? 'llama3.2:3b'
        : 'gemini-3.8-flash')
  );

  const [showKey, setShowKey] = useState<boolean>(false);
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [latencyResult, setLatencyResult] = useState<number | null>(null);
  const [hasChanges, setHasChanges] = useState<boolean>(false);

  // Model matrix view mode: 'curated' vs 'live'
  const [modelViewMode, setModelViewMode] = useState<'curated' | 'live'>('curated');

  // Dynamic model list fetched from provider's API
  const [fetchedModels, setFetchedModels] = useState<string[]>([]);
  const [isFetchingModels, setIsFetchingModels] = useState<boolean>(false);
  const [fetchModelError, setFetchModelError] = useState<string | null>(null);
  const fetchAbortRef = useRef<AbortController | null>(null);

  const styles = useMemo(() => createStyles(themeColors), [themeColors]);
  const activePortalMeta = PROVIDER_PORTAL_LINKS[provider];

  const handleProviderSelect = (p: AIProvider) => {
    lightHaptic();
    setProvider(p);
    setLatencyResult(null);
    setHasChanges(true);
    setFetchedModels([]);
    setFetchModelError(null);
    setModelViewMode('curated');

    const models = PROVIDER_MODELS[p];
    if (models && models.length > 0) {
      setSelectedModel(models.find((m) => m.recommended)?.id || models[0].id);
    }
  };

  // Open external URL with validation
  const handleOpenUrl = useCallback(async (url: string) => {
    lightHaptic();
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
    } else {
      Alert.alert('Cannot open link', `Direct URL:\n${url}`);
    }
  }, []);

  // Fetch available models from the provider's REST endpoint
  const fetchModels = useCallback(async () => {
    fetchAbortRef.current?.abort();
    const controller = new AbortController();
    fetchAbortRef.current = controller;

    setIsFetchingModels(true);
    setFetchModelError(null);

    try {
      if (provider === 'gemini') {
        const key = geminiKey.trim();
        if (!key) {
          setIsFetchingModels(false);
          return;
        }
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`,
          { signal: controller.signal }
        );
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const json = await res.json();
        const ids: string[] = (json.models || [])
          .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
          .map((m: any) => (m.name as string).replace('models/', ''))
          .filter(
            (id: string) =>
              Boolean(id) &&
              !id.includes('-tts') &&
              !id.includes('imagen') &&
              !id.includes('image-generation') &&
              !id.includes('embedding') &&
              !id.includes('aqa') &&
              !id.includes('robotics') &&
              !id.includes('computer-use')
          );
        setFetchedModels(ids);
        if (ids.length > 0) {
          setSelectedModel((prev) => {
            if (prev && ids.includes(prev)) return prev;
            const preferred = [
              'gemini-3.8-flash',
              'gemini-3.5-flash-lite',
              'gemini-2.5-flash',
              'gemini-2.0-flash',
              'gemini-1.5-flash',
            ];
            return preferred.find((m) => ids.includes(m)) || ids[0];
          });
        }
      } else if (provider === 'groq') {
        const key = groqKey.trim();
        if (!key) {
          setIsFetchingModels(false);
          return;
        }
        const res = await fetch('https://api.groq.com/openai/v1/models', {
          headers: { Authorization: `Bearer ${key}` },
          signal: controller.signal,
        });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const json = await res.json();
        const ids: string[] = (json.data || []).map((m: any) => m.id as string).filter(Boolean);
        setFetchedModels(ids);
        if (ids.length > 0) {
          setSelectedModel((prev) => {
            if (prev && ids.includes(prev)) return prev;
            const preferred = [
              'llama-3.3-70b-versatile',
              'llama-3.1-8b-instant',
              'llama-3.2-3b-preview',
            ];
            return preferred.find((m) => ids.includes(m)) || ids[0];
          });
        }
      } else if (provider === 'openrouter') {
        const key = openrouterKey.trim();
        if (!key) {
          setIsFetchingModels(false);
          return;
        }
        const res = await fetch('https://openrouter.ai/api/v1/models', {
          headers: { Authorization: `Bearer ${key}` },
          signal: controller.signal,
        });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const json = await res.json();
        const ids: string[] = (json.data || []).map((m: any) => m.id as string).filter(Boolean);
        setFetchedModels(ids);
        if (ids.length > 0) {
          setSelectedModel((prev) => {
            if (prev && ids.includes(prev)) return prev;
            const preferred = [
              'deepseek/deepseek-r1',
              'deepseek/deepseek-chat',
              'meta-llama/llama-3.3-70b-instruct',
              'google/gemini-2.5-flash',
              'openai/gpt-4o-mini',
            ];
            return preferred.find((m) => ids.includes(m)) || ids[0];
          });
        }
      } else if (provider === 'custom_openai') {
        const base = customBaseUrl.trim().replace(/\/+$/, '');
        if (!base) {
          setIsFetchingModels(false);
          return;
        }
        const endpoint = `${base}/models`;
        const headers: Record<string, string> = {};
        if (customKey.trim()) {
          headers.Authorization = `Bearer ${customKey.trim()}`;
        }
        const res = await fetch(endpoint, { headers, signal: controller.signal });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const json = await res.json();
        const ids: string[] = (json.data || json.models || [])
          .map((m: any) => (m.id || m.name) as string)
          .filter(Boolean);
        setFetchedModels(ids);
      }
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
      setFetchModelError('Could not load models — check key/endpoint');
    } finally {
      setIsFetchingModels(false);
    }
  }, [provider, geminiKey, groqKey, openrouterKey, customKey, customBaseUrl]);

  useEffect(() => {
    fetchModels();
    return () => {
      fetchAbortRef.current?.abort();
    };
  }, [fetchModels]);

  // Live test connection with latency benchmark
  const handleTestConnection = useCallback(async () => {
    mediumHaptic();
    setIsValidating(true);
    setLatencyResult(null);
    const startTime = Date.now();

    try {
      if (provider === 'gemini') {
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
          const err = await res.json().catch(() => ({}));
          Alert.alert('Connection Failed', err.error?.message || 'Check your Gemini key.');
        }
      } else if (provider === 'groq') {
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
            model: selectedModel || 'llama-3.3-70b-versatile',
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
          const err = await res.json().catch(() => ({}));
          Alert.alert('Connection Failed', err.error?.message || 'Check your Groq API key.');
        }
      } else if (provider === 'openrouter') {
        if (!openrouterKey || openrouterKey.trim().length === 0) {
          errorHaptic();
          Alert.alert('Key Required', 'Please enter your OpenRouter API key.');
          return;
        }

        const res = await fetch(OPENROUTER_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${openrouterKey.trim()}`,
            'HTTP-Referer': 'https://github.com/ZeroWallet',
            'X-Title': 'ZeroWallet AI Copilot',
          },
          body: JSON.stringify({
            model: selectedModel || 'deepseek/deepseek-r1',
            messages: [{ role: 'user', content: 'ping' }],
            max_tokens: 5,
          }),
        });

        const elapsed = Date.now() - startTime;
        if (res.ok) {
          lightHaptic();
          setLatencyResult(elapsed);
          Alert.alert('BENCHMARK PASSED', `Connected to OpenRouter in ${elapsed}ms.`);
        } else {
          errorHaptic();
          const err = await res.json().catch(() => ({}));
          Alert.alert('Connection Failed', err.error?.message || 'Check your OpenRouter API key.');
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
            model: selectedModel || 'llama3.2:3b',
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
  }, [provider, geminiKey, groqKey, openrouterKey, customKey, customBaseUrl, selectedModel]);

  const handleSave = () => {
    heavyHaptic();
    const activeApiKey =
      provider === 'groq'
        ? groqKey
        : provider === 'gemini'
        ? geminiKey
        : provider === 'openrouter'
        ? openrouterKey
        : customKey;

    updateAISettings({
      provider,
      system1Enabled,
      apiKey: activeApiKey,
      groqApiKey: groqKey,
      geminiApiKey: geminiKey,
      openrouterApiKey: openrouterKey,
      customApiKey: customKey,
      customBaseUrl,
      selectedModel,
      isConfigured:
        provider === 'custom_openai' ? true : Boolean(activeApiKey && activeApiKey.length > 0),
    });

    setHasChanges(false);
    Alert.alert('CONFIGURED', 'AI Assistant preferences updated.');
  };

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
            {(['gemini', 'groq', 'openrouter', 'custom_openai'] as AIProvider[]).map((p) => {
              const isSelected = provider === p;
              const meta = PROVIDER_LABELS[p];
              const shortName =
                p === 'gemini'
                  ? 'GEMINI'
                  : p === 'groq'
                  ? 'GROQ'
                  : p === 'openrouter'
                  ? 'OPENROUTER'
                  : 'LOCAL SLM';

              const badgeText =
                p === 'gemini'
                  ? 'Multimodal'
                  : p === 'groq'
                  ? 'Ultra-Fast'
                  : p === 'openrouter'
                  ? 'Unified'
                  : 'Private';

              return (
                <TouchableOpacity
                  key={p}
                  style={[styles.providerTab, isSelected ? styles.providerTabActive : null]}
                  onPress={() => handleProviderSelect(p)}
                >
                  <Text
                    style={[styles.providerTabTitle, isSelected ? styles.providerTabTitleActive : null]}
                    numberOfLines={1}
                  >
                    {shortName}
                  </Text>
                  <Text
                    style={[styles.providerTabSub, isSelected ? styles.providerTabSubActive : null]}
                    numberOfLines={1}
                  >
                    {badgeText}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* CARD 3: PROVIDER PORTAL & DOCUMENTATION LINKS */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardHeaderTitle}>PROVIDER PORTAL & DOCUMENTATION</Text>
            {activePortalMeta?.badge && (
              <View style={styles.recBadge}>
                <Text style={styles.recBadgeText}>{activePortalMeta.badge}</Text>
              </View>
            )}
          </View>
          <View style={styles.portalBody}>
            <View style={styles.portalMetaHeader}>
              <MaterialCommunityIcons
                name={activePortalMeta?.icon || 'brain'}
                size={22}
                color={themeColors.text}
              />
              <View style={styles.portalMetaTexts}>
                <Text style={styles.portalName}>{activePortalMeta?.name}</Text>
                <Text style={styles.portalSubtitle}>{activePortalMeta?.subtitle}</Text>
              </View>
            </View>

            <Text style={styles.portalDescription}>{activePortalMeta?.description}</Text>

            <View style={styles.freeTierRow}>
              <MaterialCommunityIcons name="tag-outline" size={14} color={themeColors.textSecondary} />
              <Text style={styles.freeTierText}>{activePortalMeta?.freeTier}</Text>
            </View>

            <View style={styles.portalLinksGrid}>
              <TouchableOpacity
                style={styles.portalLinkButton}
                onPress={() => handleOpenUrl(activePortalMeta.consoleUrl)}
              >
                <MaterialCommunityIcons name="key-outline" size={15} color={themeColors.text} />
                <Text style={styles.portalLinkButtonText} numberOfLines={1}>
                  {activePortalMeta.consoleLabel}
                </Text>
                <MaterialCommunityIcons name="open-in-new" size={12} color={themeColors.textSecondary} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.portalLinkButton}
                onPress={() => handleOpenUrl(activePortalMeta.docsUrl)}
              >
                <MaterialCommunityIcons name="book-open-outline" size={15} color={themeColors.text} />
                <Text style={styles.portalLinkButtonText} numberOfLines={1}>
                  Official Docs & Guide
                </Text>
                <MaterialCommunityIcons name="open-in-new" size={12} color={themeColors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* CARD 4: CREDENTIALS & SECURITY VAULT */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardHeaderTitle}>CREDENTIALS & SECURITY</Text>
          </View>

          {provider !== 'custom_openai' ? (
            <View style={styles.cardBody}>
              <Text style={styles.fieldLabel}>
                {provider === 'groq'
                  ? 'GROQ API KEY'
                  : provider === 'openrouter'
                  ? 'OPENROUTER API KEY'
                  : 'GOOGLE GEMINI API KEY'}
              </Text>
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.keyInput}
                  value={
                    provider === 'groq'
                      ? groqKey
                      : provider === 'openrouter'
                      ? openrouterKey
                      : geminiKey
                  }
                  onChangeText={(val) => {
                    if (provider === 'groq') setGroqKey(val.trim());
                    else if (provider === 'openrouter') setOpenrouterKey(val.trim());
                    else setGeminiKey(val.trim());
                    setHasChanges(true);
                  }}
                  placeholder={
                    provider === 'groq'
                      ? 'Paste gsk_... key'
                      : provider === 'openrouter'
                      ? 'Paste sk-or-... key'
                      : 'Paste AIza... key'
                  }
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

              <TouchableOpacity
                style={styles.linkRow}
                onPress={() => handleOpenUrl(activePortalMeta.consoleUrl)}
              >
                <MaterialCommunityIcons name="open-in-new" size={14} color={themeColors.text} />
                <Text style={styles.linkText}>
                  Get free API key from {activePortalMeta.consoleLabel}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.cardBody}>
              <Text style={styles.fieldLabel}>QUICK ENDPOINT PRESETS</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.presetRow}
              >
                {LOCAL_ENDPOINT_PRESETS.map((preset) => {
                  const isPresetActive = customBaseUrl.trim() === preset.baseUrl.trim();
                  return (
                    <TouchableOpacity
                      key={preset.id}
                      style={[styles.presetPill, isPresetActive ? styles.presetPillActive : null]}
                      onPress={() => {
                        lightHaptic();
                        setCustomBaseUrl(preset.baseUrl);
                        setSelectedModel(preset.defaultModel);
                        setHasChanges(true);
                      }}
                    >
                      <Text
                        style={[
                          styles.presetPillText,
                          isPresetActive ? styles.presetPillTextActive : null,
                        ]}
                      >
                        {preset.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <Text style={[styles.fieldLabel, { marginTop: spacing.md }]}>
                LOCAL ENDPOINT BASE URL
              </Text>
              <TextInput
                style={styles.plainInput}
                value={customBaseUrl}
                onChangeText={(val) => {
                  setCustomBaseUrl(val.trim());
                  setHasChanges(true);
                }}
                placeholder="http://localhost:11434/v1"
                placeholderTextColor={themeColors.textSecondary}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Text style={styles.hintText}>
                Android Emulator host: http://10.0.2.2:11434/v1 · Physical device: use LAN IP
              </Text>

              <Text style={[styles.fieldLabel, { marginTop: spacing.md }]}>
                BEARER TOKEN (OPTIONAL)
              </Text>
              <TextInput
                style={styles.plainInput}
                value={customKey}
                onChangeText={(val) => {
                  setCustomKey(val.trim());
                  setHasChanges(true);
                }}
                placeholder="Authorization header token (e.g. OpenAI key)"
                placeholderTextColor={themeColors.textSecondary}
                secureTextEntry={!showKey}
                autoCapitalize="none"
              />
            </View>
          )}
        </View>

        {/* CARD 5: FOUNDATION MODEL MATRIX */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardHeaderTitle}>FOUNDATION MODEL MATRIX</Text>
            <View style={styles.modelHeaderActions}>
              {fetchedModels.length > 0 && (
                <View style={styles.modeToggleGroup}>
                  <TouchableOpacity
                    style={[
                      styles.modeToggleBtn,
                      modelViewMode === 'curated' ? styles.modeToggleBtnActive : null,
                    ]}
                    onPress={() => {
                      lightHaptic();
                      setModelViewMode('curated');
                    }}
                  >
                    <Text
                      style={[
                        styles.modeToggleText,
                        modelViewMode === 'curated' ? styles.modeToggleTextActive : null,
                      ]}
                    >
                      CURATED
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.modeToggleBtn,
                      modelViewMode === 'live' ? styles.modeToggleBtnActive : null,
                    ]}
                    onPress={() => {
                      lightHaptic();
                      setModelViewMode('live');
                    }}
                  >
                    <Text
                      style={[
                        styles.modeToggleText,
                        modelViewMode === 'live' ? styles.modeToggleTextActive : null,
                      ]}
                    >
                      LIVE ({fetchedModels.length})
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              <TouchableOpacity
                onPress={() => {
                  lightHaptic();
                  fetchModels();
                }}
                hitSlop={8}
                disabled={isFetchingModels}
              >
                {isFetchingModels ? (
                  <ActivityIndicator size="small" color={themeColors.textSecondary} />
                ) : (
                  <MaterialCommunityIcons
                    name="refresh"
                    size={16}
                    color={themeColors.textSecondary}
                  />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {isFetchingModels && fetchedModels.length === 0 ? (
            <View style={styles.modelLoadingRow}>
              <ActivityIndicator size="small" color={themeColors.textSecondary} />
              <Text style={styles.modelLoadingText}>QUERYING PROVIDER MODEL ENDPOINTS…</Text>
            </View>
          ) : modelViewMode === 'live' && fetchedModels.length > 0 ? (
            /* Live models list from API */
            fetchedModels.map((modelId, idx) => {
              const isSelected = selectedModel === modelId;
              return (
                <React.Fragment key={modelId}>
                  {idx > 0 && <View style={styles.divider} />}
                  <TouchableOpacity
                    style={[styles.modelRow, isSelected ? styles.modelRowActive : null]}
                    onPress={() => {
                      lightHaptic();
                      setSelectedModel(modelId);
                      setHasChanges(true);
                    }}
                  >
                    <View style={styles.modelLeft}>
                      <Text style={[styles.modelName, isSelected ? styles.modelNameActive : null]}>
                        {modelId}
                      </Text>
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
            })
          ) : (
            /* Curated models with architectural details */
            <>
              {fetchModelError && (
                <View style={styles.modelErrorBanner}>
                  <MaterialCommunityIcons
                    name="information-outline"
                    size={13}
                    color={themeColors.textSecondary}
                  />
                  <Text style={styles.modelErrorText}>
                    Showing optimized recommendations · Enter API key to unlock dynamic catalog
                  </Text>
                </View>
              )}
              {(PROVIDER_MODELS[provider] || []).map((m, idx) => {
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
                          <Text
                            style={[styles.modelName, isSelected ? styles.modelNameActive : null]}
                          >
                            {m.name}
                          </Text>
                          {m.recommended && (
                            <View style={styles.recBadge}>
                              <Text style={styles.recBadgeText}>DEFAULT</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.modelDesc}>{m.description}</Text>
                        <View style={styles.specsRow}>
                          <Text style={styles.specBadge}>
                            ⚡ {m.speed === 3 ? 'Ultra-Fast' : m.speed === 2 ? 'Fast' : 'Deep'}
                          </Text>
                          <Text style={styles.specBadge}>
                            🎯 {m.accuracy === 4 ? 'Best Reasoning' : 'High Accuracy'}
                          </Text>
                          {m.bestFor ? (
                            <Text style={styles.bestForText} numberOfLines={1}>
                              {m.bestFor}
                            </Text>
                          ) : null}
                        </View>
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
            </>
          )}
        </View>

        {/* CARD 6: LATENCY BENCHMARK & TEST */}
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
                  <Text style={styles.pingButtonText}>RUN LIVE BENCHMARK</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* FLOATING SAVE BUTTON */}
      <TouchableOpacity
        style={[styles.saveButton, !hasChanges ? styles.saveButtonMuted : null]}
        onPress={handleSave}
      >
        <Text style={styles.saveButtonText}>SAVE ARCHITECTURAL PREFERENCES</Text>
      </TouchableOpacity>
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
      paddingBottom: 120,
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
    cardHeaderRow: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: theme.hairline || theme.border,
      backgroundColor: theme.background,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
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
      fontSize: 10,
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
    portalBody: {
      padding: spacing.md,
    },
    portalMetaHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.xs,
    },
    portalMetaTexts: {
      flex: 1,
    },
    portalName: {
      ...typography.body,
      color: theme.text,
      fontWeight: '700',
      fontSize: 14,
    },
    portalSubtitle: {
      ...typography.caption,
      color: theme.textSecondary,
      fontSize: 11,
    },
    portalDescription: {
      ...typography.caption,
      color: theme.text,
      fontSize: 12,
      lineHeight: 17,
      marginTop: spacing.xs,
      marginBottom: spacing.xs,
    },
    freeTierRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: spacing.md,
      marginTop: 2,
    },
    freeTierText: {
      ...typography.caption,
      color: theme.textSecondary,
      fontSize: 11,
      fontWeight: '500',
    },
    portalLinksGrid: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    portalLinkButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderWidth: 1,
      borderColor: theme.hairline || theme.border,
      borderRadius: 2,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.sm,
      backgroundColor: theme.background,
      gap: 4,
    },
    portalLinkButtonText: {
      ...typography.caption,
      color: theme.text,
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 0.3,
      flex: 1,
    },
    presetRow: {
      flexDirection: 'row',
      gap: spacing.xs,
      paddingVertical: spacing.xs,
    },
    presetPill: {
      borderWidth: 1,
      borderColor: theme.hairline || theme.border,
      borderRadius: 2,
      paddingHorizontal: spacing.sm,
      paddingVertical: 5,
      backgroundColor: theme.background,
    },
    presetPillActive: {
      borderColor: theme.text,
      backgroundColor: theme.text,
    },
    presetPillText: {
      ...typography.caption,
      fontSize: 10,
      fontWeight: '600',
      color: theme.text,
    },
    presetPillTextActive: {
      color: theme.background,
    },
    hintText: {
      ...typography.caption,
      color: theme.textSecondary,
      fontSize: 10,
      marginTop: 4,
      fontStyle: 'italic',
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
    modelHeaderActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    modeToggleGroup: {
      flexDirection: 'row',
      borderWidth: 1,
      borderColor: theme.hairline || theme.border,
      borderRadius: 2,
      overflow: 'hidden',
    },
    modeToggleBtn: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      backgroundColor: theme.background,
    },
    modeToggleBtnActive: {
      backgroundColor: theme.text,
    },
    modeToggleText: {
      ...typography.caption,
      fontSize: 8,
      fontWeight: '700',
      letterSpacing: 0.5,
      color: theme.textSecondary,
    },
    modeToggleTextActive: {
      color: theme.background,
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
      marginBottom: 3,
    },
    specsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      flexWrap: 'wrap',
    },
    specBadge: {
      ...typography.caption,
      fontSize: 9,
      color: theme.text,
      borderWidth: 1,
      borderColor: theme.hairline || theme.border,
      paddingHorizontal: 4,
      paddingVertical: 1,
      borderRadius: 2,
      backgroundColor: theme.background,
    },
    bestForText: {
      ...typography.caption,
      fontSize: 9,
      color: theme.textSecondary,
      fontStyle: 'italic',
      flex: 1,
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
      position: 'absolute',
      left: 20,
      right: 20,
      bottom: Platform.OS === 'ios' ? 24 : 16,
      height: 52,
      borderWidth: 1,
      borderColor: theme.text,
      backgroundColor: theme.text,
      borderRadius: 2,
      alignItems: 'center',
      justifyContent: 'center',
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
    modelLoadingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
    },
    modelLoadingText: {
      ...typography.caption,
      color: theme.textSecondary,
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 1,
    },
    modelErrorBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      marginBottom: spacing.xs,
    },
    modelErrorText: {
      ...typography.caption,
      color: theme.textSecondary,
      fontSize: 10,
      fontWeight: '600',
      flex: 1,
    },
  });
