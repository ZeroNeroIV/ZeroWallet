/**
 * Purpose: AI Assistant Chat Screen
 *
 * Implements a Hybrid Architecture:
 *   1. Laya System-1 Fast Decision Router: Handles instant transaction parsing,
 *      balance lookups, and spending queries in <20ms on-device.
 *   2. System-2 Multi-Provider Engine: Groq Cloud (Llama 3.2 SLMs), Google Gemini,
 *      or Local Ollama/OpenAI for deep financial reasoning and budgeting advice.
 *
 * Airy Minimalist Bento design with high contrast badges and quick action chips.
 */

import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAIChatStore } from '../../store/aiChatStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useAuthStore } from '../../store/authStore';
import { MessageBubble } from '../../components/chat/MessageBubble';
import { ChatInput } from '../../components/chat/ChatInput';
import { TypingIndicator } from '../../components/chat/TypingIndicator';
import { LayaSystem1Router } from '../../services/ai/layaSystem1';
import { AIProviderService } from '../../services/ai/aiProviderService';
import { ChatContextManager } from '../../services/ai/chatContextManager';
import { spacing, borderRadius } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { useThemeColors } from '../../hooks/useThemeColors';
import { lightHaptic, mediumHaptic } from '../../services/haptics/hapticFeedback';
import { AccountRepository } from '../../database/repositories/AccountRepository';

const QUICK_SUGGESTIONS = [
  { icon: 'lightning-bolt', label: 'Spent 10 on lunch', text: 'Spent 10 on lunch' },
  { icon: 'wallet-outline', label: 'Check balance', text: "What's my current balance?" },
  { icon: 'chart-pie', label: 'Spending this month', text: 'How much did I spend this month?' },
  { icon: 'calendar-sync', label: 'Upcoming bills', text: 'What are my upcoming bills and subscriptions?' },
];

export default function ChatScreen({ navigation }: any) {
  const themeColors = useThemeColors();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);

  const {
    messages,
    isLoading,
    addMessage,
    clearMessages,
    setLoading,
    setError,
    addPendingAction,
  } = useAIChatStore();

  const settingsStore = useSettingsStore();
  const aiSettings = settingsStore.aiSettings;
  const { currentAccountId, currentUser } = useAuthStore();

  const [accountCurrency, setAccountCurrency] = useState<string>('USD');
  const flashListRef = useRef<any>(null);

  // Load account currency
  useEffect(() => {
    if (!currentAccountId) return;
    new AccountRepository().findById(currentAccountId).then((acc) => {
      if (acc?.currency) setAccountCurrency(acc.currency);
    });
  }, [currentAccountId]);

  // Auto scroll to latest message
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flashListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

  // Provider label badge
  const engineLabel = useMemo(() => {
    const isSys1 = aiSettings?.system1Enabled !== false;
    const providerName =
      aiSettings?.provider === 'groq'
        ? 'Groq (Llama-3.2)'
        : aiSettings?.provider === 'custom_openai'
        ? 'Local SLM'
        : 'Gemini';

    return isSys1 ? `⚡ Laya + ${providerName}` : providerName;
  }, [aiSettings]);

  // Handle sending a message
  const handleSend = useCallback(
    async (text: string) => {
      if (!currentAccountId || !currentUser?.id) {
        Alert.alert('Error', 'No account or user session active');
        return;
      }

      const promptText = text.trim();
      if (!promptText) return;

      // 1. Add user message
      addMessage('user', promptText);
      setLoading(true);
      setError(null);

      try {
        // 2. Try Laya System-1 Fast Router first (if enabled)
        if (aiSettings?.system1Enabled !== false) {
          const system1 = new LayaSystem1Router(currentAccountId, currentUser.id, accountCurrency);
          const s1Result = await system1.route(promptText);

          if (s1Result.handled) {
            let pendingActionId: string | undefined;
            if (s1Result.pendingActions && s1Result.pendingActions.length > 0) {
              s1Result.pendingActions.forEach((act) => {
                addPendingAction(act);
              });
              pendingActionId = s1Result.pendingActions[0].id;
            }

            addMessage('assistant', s1Result.text, false, pendingActionId);
            setLoading(false);
            return;
          }
        }

        // 3. Fallback to System-2 Multi-Provider Engine
        const providerService = new AIProviderService(aiSettings, currentAccountId, currentUser.id);
        const context = await ChatContextManager.buildContext(messages, currentAccountId);
        const response = await providerService.sendMessage(promptText, context);

        let pendingActionId: string | undefined;
        if (response.pendingActions && response.pendingActions.length > 0) {
          response.pendingActions.forEach((action) => {
            addPendingAction(action);
          });
          pendingActionId = response.pendingActions[0].id;
        }

        addMessage('assistant', response.text, false, pendingActionId);

        // Update usage statistics
        settingsStore.updateAISettings({
          conversationCount: (aiSettings?.conversationCount || 0) + 1,
          lastUsed: Date.now(),
        });
      } catch (err: any) {
        console.error('[ChatScreen] Send error:', err);
        const errorMsg =
          err?.message || 'Failed to communicate with AI provider. Please check your settings.';

        addMessage('assistant', `⚠️ ${errorMsg}`, true);

        // Suggest settings if key missing
        if (errorMsg.includes('not configured') || errorMsg.includes('key')) {
          Alert.alert('Provider Key Required', errorMsg, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Configure Provider', onPress: () => navigation.navigate('AISettings') },
          ]);
        }
      } finally {
        setLoading(false);
      }
    },
    [currentAccountId, currentUser, accountCurrency, aiSettings, messages, navigation]
  );

  const handleClearHistory = () => {
    mediumHaptic();
    Alert.alert('Clear Chat History', 'Are you sure you want to clear this conversation?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear All',
        style: 'destructive',
        onPress: () => {
          clearMessages();
        },
      },
    ]);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Top Engine Banner */}
      <View style={styles.topBanner}>
        <View style={styles.engineBadge}>
          <View style={styles.engineDot} />
          <Text style={styles.engineBadgeText}>{engineLabel}</Text>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => navigation.navigate('AISettings')}
            hitSlop={8}
          >
            <MaterialCommunityIcons name="cog-outline" size={20} color={themeColors.textSecondary} />
          </TouchableOpacity>

          {messages.length > 0 && (
            <TouchableOpacity style={styles.iconBtn} onPress={handleClearHistory} hitSlop={8}>
              <MaterialCommunityIcons name="trash-can-outline" size={20} color={themeColors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Messages List or Empty State */}
      <View style={styles.listContainer}>
        {messages.length === 0 ? (
          <ScrollView contentContainerStyle={styles.emptyContainer}>
            <View style={styles.emptyBento}>
              <View style={[styles.avatarCircle, { backgroundColor: `${themeColors.primary}20` }]}>
                <MaterialCommunityIcons name="robot-outline" size={36} color={themeColors.primary} />
              </View>
              <Text style={styles.emptyTitle}>ZeroWallet Financial AI</Text>
              <Text style={styles.emptySubtitle}>
                Powered by a hybrid architecture with <Text style={styles.boldText}>Laya System-1</Text> for instant (&lt;20ms) parsing and multi-provider SLMs for personalized financial planning.
              </Text>

              <View style={styles.capabilityRow}>
                <View style={styles.capItem}>
                  <MaterialCommunityIcons name="lightning-bolt" size={18} color="#F59E0B" />
                  <Text style={styles.capText}>Instant Actions (&lt;20ms)</Text>
                </View>
                <View style={styles.capItem}>
                  <MaterialCommunityIcons name="shield-check-outline" size={18} color={themeColors.success} />
                  <Text style={styles.capText}>Confirmation Required</Text>
                </View>
              </View>
            </View>

            {/* Quick Action Suggestion Cards */}
            <Text style={styles.suggestionsHeading}>TRY A QUICK COMMAND</Text>
            <View style={styles.suggestionsGrid}>
              {QUICK_SUGGESTIONS.map((item, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={styles.suggestionCard}
                  onPress={() => {
                    lightHaptic();
                    handleSend(item.text);
                  }}
                  activeOpacity={0.8}
                >
                  <MaterialCommunityIcons name={item.icon as any} size={18} color={themeColors.primary} />
                  <Text style={styles.suggestionText}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        ) : (
          <FlashList
            ref={flashListRef}
            data={messages}
            renderItem={({ item }) => <MessageBubble message={item} />}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
          />
        )}
      </View>

      {/* Typing Indicator */}
      {isLoading && (
        <View style={styles.typingContainer}>
          <TypingIndicator isVisible={isLoading} />
        </View>
      )}

      {/* Quick Pills Bar (When messages exist) */}
      {messages.length > 0 && !isLoading && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.horizontalPills}
        >
          {QUICK_SUGGESTIONS.map((item, idx) => (
            <TouchableOpacity
              key={idx}
              style={styles.miniPill}
              onPress={() => {
                lightHaptic();
                handleSend(item.text);
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.miniPillText}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Input */}
      <ChatInput onSend={handleSend} isLoading={isLoading} />
    </KeyboardAvoidingView>
  );
}

const createStyles = (themeColors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: themeColors.background,
    },
    topBanner: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: themeColors.cardBorder,
      backgroundColor: themeColors.surface,
    },
    engineBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: themeColors.surfaceHighlight,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: borderRadius.round,
      borderWidth: 1,
      borderColor: themeColors.cardBorder,
    },
    engineDot: {
      width: 7,
      height: 7,
      borderRadius: 3.5,
      backgroundColor: '#10B981',
    },
    engineBadgeText: {
      ...typography.caption,
      fontWeight: '700',
      color: themeColors.text,
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    iconBtn: {
      padding: 6,
    },
    listContainer: {
      flex: 1,
    },
    listContent: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    emptyContainer: {
      padding: spacing.lg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyBento: {
      width: '100%',
      backgroundColor: themeColors.surface,
      borderRadius: 24,
      padding: 22,
      borderWidth: 1,
      borderColor: themeColors.cardBorder,
      alignItems: 'center',
      marginBottom: 24,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 3,
    },
    avatarCircle: {
      width: 64,
      height: 64,
      borderRadius: 32,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 14,
    },
    emptyTitle: {
      ...typography.h3,
      fontWeight: '800',
      color: themeColors.text,
      marginBottom: 8,
    },
    emptySubtitle: {
      ...typography.bodySmall,
      color: themeColors.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
      marginBottom: 16,
    },
    boldText: {
      fontWeight: '700',
      color: themeColors.text,
    },
    capabilityRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: themeColors.cardBorder,
    },
    capItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    capText: {
      ...typography.caption,
      color: themeColors.textMuted,
      fontWeight: '600',
    },
    suggestionsHeading: {
      ...typography.caption,
      color: themeColors.textMuted,
      fontWeight: '800',
      letterSpacing: 0.8,
      alignSelf: 'flex-start',
      marginBottom: 12,
    },
    suggestionsGrid: {
      width: '100%',
      gap: 10,
    },
    suggestionCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: themeColors.surface,
      borderRadius: 16,
      padding: 14,
      borderWidth: 1,
      borderColor: themeColors.cardBorder,
    },
    suggestionText: {
      ...typography.bodySmall,
      fontWeight: '600',
      color: themeColors.text,
      flex: 1,
    },
    typingContainer: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.xs,
    },
    horizontalPills: {
      paddingHorizontal: spacing.lg,
      paddingBottom: 8,
      gap: 8,
    },
    miniPill: {
      backgroundColor: themeColors.surface,
      borderRadius: borderRadius.round,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderWidth: 1,
      borderColor: themeColors.cardBorder,
    },
    miniPillText: {
      ...typography.caption,
      color: themeColors.textSecondary,
      fontWeight: '600',
    },
  });
