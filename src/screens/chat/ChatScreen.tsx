/**
 * ChatScreen — Financial Intelligence Console
 *
 * Full-featured autonomous financial assistant:
 *  1. Foundation LLM Engine (Gemini 3.8 Flash, Groq Llama 3.3, Ollama) as the primary reasoning brain
 *  2. LAYA System-1 Fast Classifier (<20ms local intent & categorization engine)
 *  3. Interactive Generative UI (Gifted Charts, Ledger Mutation Tickets, Health Gauges)
 *  4. Native Bidirectional Live Voice Call with real mic speech detection & voice synthesis
 *  5. Fully responsive hairline layout with zero horizontal overflows
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
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAIChatStore } from '../../store/aiChatStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useAuthStore } from '../../store/authStore';
import { useAccountStore } from '../../store/accountStore';
import { MessageBubble } from '../../components/chat/MessageBubble';
import { ChatInput } from '../../components/chat/ChatInput';
import { TypingIndicator } from '../../components/chat/TypingIndicator';
import { LayaHarness } from '../../services/ai/harness/LayaHarness';
import { LayaVoiceService } from '../../services/ai/harness/voice/layaVoiceService';
import { LayaLiveCallModal } from '../../components/chat/LayaLiveCallModal';
import { ChatContextManager } from '../../services/ai/chatContextManager';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { useThemeColors } from '../../hooks/useThemeColors';
import { lightHaptic, mediumHaptic } from '../../services/haptics/hapticFeedback';
import { AccountRepository } from '../../database/repositories/AccountRepository';

const QUICK_COMMAND_CHIPS = [
  { label: 'SPENT $15 ON LUNCH', text: 'Spent 15 on lunch' },
  { label: 'SHOW SPENDING CHART', text: 'Generate an interactive chart of my spending this month' },
  { label: 'FINANCIAL HEALTH AUDIT', text: 'Audit my financial health, calculate runway and health score' },
  { label: 'CHECK RUNWAY & BALANCES', text: "What's my current balance and runway?" },
  { label: 'MONTHLY EXPENSE BREAKDOWN', text: 'How much did I spend this month and what are the top categories?' },
  { label: 'UPCOMING BILLS & DUES', text: 'What are my upcoming bills and recurring commitments?' },
  { label: 'SAVINGS ADVICE', text: 'How can I optimize my savings rate this month?' },
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
  const [isVoiceCallVisible, setIsVoiceCallVisible] = useState<boolean>(false);
  const scrollViewRef = useRef<ScrollView>(null);

  const accountBalances = useAccountStore((s) => (currentAccountId ? s.balances[currentAccountId] : undefined));
  const totalBalance = accountBalances?.totalBalance ?? 0;

  useEffect(() => {
    if (!currentAccountId) return;
    new AccountRepository().findById(currentAccountId).then((acc) => {
      if (acc?.currency) setAccountCurrency(acc.currency);
    });
  }, [currentAccountId]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length, isLoading]);

  const providerName = useMemo(() => {
    const model = aiSettings?.selectedModel || 'gemini-3.8-flash';
    if (aiSettings?.provider === 'groq') return 'GROQ LLAMA 3.3';
    if (aiSettings?.provider === 'custom_openai') return 'LOCAL SLM';
    if (model.includes('3.8')) return 'GEMINI 3.8 FLASH';
    if (model.includes('3.5')) return 'GEMINI 3.5';
    if (model.includes('2.5')) return 'GEMINI 2.5 FLASH';
    return 'GEMINI';
  }, [aiSettings]);

  const voiceService = useMemo(() => {
    if (!currentAccountId || !currentUser?.id || !aiSettings) return null;
    const harness = new LayaHarness(
      aiSettings,
      currentAccountId,
      currentUser.id,
      accountCurrency,
      totalBalance
    );
    const key = aiSettings?.geminiApiKey || aiSettings?.apiKey || '';
    return new LayaVoiceService(harness, key, providerName);
  }, [aiSettings, currentAccountId, currentUser?.id, accountCurrency, totalBalance, providerName]);

  const engineNameBadge = useMemo(() => {
    const isSys1 = aiSettings?.system1Enabled !== false;
    const shortName =
      providerName.includes('3.8')
        ? 'GEMINI 3.8'
        : providerName.includes('GROQ')
        ? 'GROQ'
        : providerName.includes('LOCAL')
        ? 'LOCAL'
        : 'GEMINI';

    return isSys1 ? `⚡ ${shortName}` : shortName;
  }, [aiSettings, providerName]);

  const handleSend = useCallback(
    async (text: string) => {
      if (!currentAccountId || !currentUser?.id) {
        Alert.alert('Session Error', 'No active user session found.');
        return;
      }

      const promptText = text.trim();
      if (!promptText) return;

      addMessage('user', promptText);
      setLoading(true);
      setError(null);

      try {
        const harness = new LayaHarness(
          aiSettings,
          currentAccountId,
          currentUser.id,
          accountCurrency,
          totalBalance
        );
        const context = await ChatContextManager.buildContext(messages, currentAccountId);
        const response = await harness.processMessage(promptText, context);

        let pendingActionId: string | undefined;
        if (response.pendingActions && response.pendingActions.length > 0) {
          response.pendingActions.forEach((action) => {
            addPendingAction(action);
          });
          pendingActionId = response.pendingActions[0].id;
        }

        const badge = response.engineBadge === 'system1' ? 'LAYA CLASSIFIER (<20MS)' : providerName;

        addMessage(
          'assistant',
          response.text,
          false,
          pendingActionId,
          response.widgets,
          badge
        );

        settingsStore.updateAISettings({
          conversationCount: (aiSettings?.conversationCount || 0) + 1,
          lastUsed: Date.now(),
        });
      } catch (err: any) {
        console.error('[ChatScreen] Send error:', err);
        const errorMsg =
          err?.message || 'Failed to communicate with intelligence provider. Please verify API key.';

        addMessage('assistant', errorMsg, true);

        if (errorMsg.includes('not configured') || errorMsg.includes('key')) {
          Alert.alert('Configuration Required', errorMsg, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Configure Engine', onPress: () => navigation.navigate('AISettings') },
          ]);
        }
      } finally {
        setLoading(false);
      }
    },
    [currentAccountId, currentUser, accountCurrency, totalBalance, aiSettings, messages, navigation, addMessage, addPendingAction, setLoading, setError, settingsStore, providerName]
  );

  const handleClearHistory = () => {
    mediumHaptic();
    Alert.alert('PURGE CONVERSATION', 'Are you sure you want to clear this ledger transcript?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear Transcript',
        style: 'destructive',
        onPress: () => {
          clearMessages();
        },
      },
    ]);
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Responsive Architectural Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => {
              lightHaptic();
              navigation.goBack();
            }}
          >
            <MaterialCommunityIcons name="arrow-left" size={17} color={themeColors.text} />
          </TouchableOpacity>
          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerSuper} numberOfLines={1}>
              FINANCIAL INTELLIGENCE
            </Text>
            <Text style={styles.headerTitle} numberOfLines={1}>
              AI COPILOT
            </Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          <View style={styles.engineBadge}>
            <Text style={styles.engineBadgeText} numberOfLines={1}>
              {engineNameBadge}
            </Text>
          </View>

          {/* Live Voice Call Trigger */}
          <TouchableOpacity
            style={[styles.actionBtn, styles.liveCallHeaderBtn]}
            onPress={() => {
              mediumHaptic();
              setIsVoiceCallVisible(true);
              voiceService?.startCall();
            }}
          >
            <MaterialCommunityIcons name="phone-in-talk" size={16} color={themeColors.primary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => {
              lightHaptic();
              navigation.navigate('AISettings');
            }}
          >
            <MaterialCommunityIcons name="tune" size={16} color={themeColors.text} />
          </TouchableOpacity>

          {messages.length > 0 && (
            <TouchableOpacity style={styles.actionBtn} onPress={handleClearHistory}>
              <MaterialCommunityIcons name="trash-can-outline" size={16} color={themeColors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Stream Area */}
      <View style={styles.streamContainer}>
        {messages.length === 0 ? (
          <ScrollView
            contentContainerStyle={styles.emptySlate}
            showsVerticalScrollIndicator={false}
          >
            {/* System Specification Briefing */}
            <View style={styles.briefingCard}>
              <View style={styles.briefingHeader}>
                <Text style={styles.briefingSuper} numberOfLines={1}>
                  AUTONOMOUS FINANCIAL COPILOT
                </Text>
                <Text style={styles.briefingTitle} numberOfLines={1}>
                  ZERO WALLET · AI AGENT
                </Text>
              </View>

              <Text style={styles.briefingBody}>
                Powered by {providerName} for conversational financial analysis, interactive generative charts, and cash flow planning — augmented by LAYA on-device classifier for instant (&lt;20ms) transaction categorization.
              </Text>

              {/* Specs Table */}
              <View style={styles.specsTable}>
                <View style={styles.specRow}>
                  <Text style={styles.specLabel}>PRIMARY BRAIN</Text>
                  <Text style={styles.specVal} numberOfLines={1}>{providerName}</Text>
                </View>
                <View style={styles.specDivider} />
                <View style={styles.specRow}>
                  <Text style={styles.specLabel}>FAST CLASSIFIER</Text>
                  <Text style={styles.specVal} numberOfLines={1}>LAYA (&lt;20MS LOCAL)</Text>
                </View>
                <View style={styles.specDivider} />
                <View style={styles.specRow}>
                  <Text style={styles.specLabel}>AUDIT SAFETY</Text>
                  <Text style={styles.specVal} numberOfLines={1}>DOUBLE-ENTRY TICKET</Text>
                </View>
              </View>
            </View>

            {/* Empty State Prompts */}
            <Text style={styles.emptyPromptsTitle}>QUICK INTENT TEMPLATES</Text>
            <View style={styles.promptsGrid}>
              {QUICK_COMMAND_CHIPS.map((chip, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={styles.promptTile}
                  onPress={() => {
                    lightHaptic();
                    handleSend(chip.text);
                  }}
                >
                  <Text style={styles.promptTileText} numberOfLines={1}>
                    {chip.label}
                  </Text>
                  <MaterialCommunityIcons name="arrow-top-right" size={13} color={themeColors.textSecondary} />
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        ) : (
          <ScrollView
            ref={scrollViewRef}
            style={styles.messagesScroll}
            contentContainerStyle={styles.messagesContent}
            showsVerticalScrollIndicator={false}
          >
            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} />
            ))}
            {isLoading && <TypingIndicator isVisible={isLoading} />}
          </ScrollView>
        )}
      </View>

      {/* Horizontal Micro-Chips Bar (Accessible anytime) */}
      {!isLoading && (
        <View style={styles.chipsBar}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsScroll}
          >
            {QUICK_COMMAND_CHIPS.map((chip, idx) => (
              <TouchableOpacity
                key={idx}
                style={styles.chipPill}
                onPress={() => {
                  lightHaptic();
                  handleSend(chip.text);
                }}
              >
                <Text style={styles.chipPillText} numberOfLines={1}>{chip.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Hairline Floating Command Bar */}
      <ChatInput
        onSend={handleSend}
        isLoading={isLoading}
        engineName={engineNameBadge}
        onStartVoiceCall={() => {
          mediumHaptic();
          setIsVoiceCallVisible(true);
          voiceService?.startCall();
        }}
      />

      {/* Live Voice Call Modal */}
      <LayaLiveCallModal
        visible={isVoiceCallVisible}
        voiceService={voiceService}
        onClose={() => setIsVoiceCallVisible(false)}
        onWidgetGenerated={(widget) => {
          addMessage(
            'assistant',
            'Interactive financial widget generated during voice session:',
            false,
            undefined,
            [widget],
            providerName
          );
        }}
      />
    </KeyboardAvoidingView>
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
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: spacing.sm + 4,
      paddingTop: Platform.OS === 'ios' ? spacing.xl : spacing.md + 4,
      paddingBottom: spacing.sm + 2,
      borderBottomWidth: 1,
      borderBottomColor: theme.hairline || theme.border,
      backgroundColor: theme.card || theme.surface,
    },
    headerLeft: {
      flex: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs + 2,
    },
    backButton: {
      width: 30,
      height: 30,
      borderWidth: 1,
      borderColor: theme.hairline || theme.border,
      borderRadius: 2,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.background,
      flexShrink: 0,
    },
    headerTitleWrap: {
      flex: 1,
      minWidth: 0,
    },
    headerSuper: {
      ...typography.caption,
      color: theme.textSecondary,
      fontSize: 8,
      letterSpacing: 1.2,
      fontWeight: '700',
    },
    headerTitle: {
      ...typography.h3,
      color: theme.text,
      letterSpacing: 0.5,
      fontWeight: '700',
      fontSize: 14,
    },
    headerRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      flexShrink: 0,
    },
    engineBadge: {
      borderWidth: 1,
      borderColor: theme.hairline || theme.border,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 2,
      backgroundColor: theme.background,
      maxWidth: 105,
    },
    engineBadgeText: {
      ...typography.caption,
      color: theme.text,
      fontSize: 9,
      fontWeight: '700',
      letterSpacing: 0.5,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    actionBtn: {
      width: 30,
      height: 30,
      borderWidth: 1,
      borderColor: theme.hairline || theme.border,
      borderRadius: 2,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.background,
    },
    liveCallHeaderBtn: {
      borderColor: theme.primary + '80',
      backgroundColor: theme.primary + '10',
    },
    streamContainer: {
      flex: 1,
    },
    emptySlate: {
      padding: spacing.sm + 4,
      paddingTop: spacing.md,
    },
    briefingCard: {
      borderWidth: 1,
      borderColor: theme.hairline || theme.border,
      backgroundColor: theme.card || theme.surface,
      borderRadius: 4,
      padding: spacing.sm + 4,
      marginBottom: spacing.md,
    },
    briefingHeader: {
      marginBottom: spacing.xs,
    },
    briefingSuper: {
      ...typography.caption,
      color: theme.textSecondary,
      fontSize: 8,
      fontWeight: '700',
      letterSpacing: 1.2,
      marginBottom: 2,
    },
    briefingTitle: {
      ...typography.h3,
      color: theme.text,
      fontWeight: '700',
      letterSpacing: 0.5,
      fontSize: 14,
    },
    briefingBody: {
      ...typography.body,
      color: theme.textSecondary,
      fontSize: 11,
      lineHeight: 16,
      marginBottom: spacing.sm,
    },
    specsTable: {
      borderTopWidth: 1,
      borderTopColor: theme.hairline || theme.border,
      paddingTop: 4,
    },
    specRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 4,
    },
    specDivider: {
      borderTopWidth: 1,
      borderTopColor: theme.hairline || theme.border,
    },
    specLabel: {
      ...typography.caption,
      color: theme.textSecondary,
      fontSize: 9,
      fontWeight: '700',
      letterSpacing: 0.6,
      flexShrink: 0,
    },
    specVal: {
      ...typography.caption,
      color: theme.text,
      fontSize: 9,
      fontWeight: '700',
      letterSpacing: 0.5,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      flexShrink: 1,
      textAlign: 'right',
    },
    emptyPromptsTitle: {
      ...typography.caption,
      color: theme.textSecondary,
      fontSize: 9,
      fontWeight: '700',
      letterSpacing: 1.2,
      marginBottom: spacing.xs,
    },
    promptsGrid: {
      gap: 6,
    },
    promptTile: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.hairline || theme.border,
      backgroundColor: theme.card || theme.surface,
      borderRadius: 2,
      paddingHorizontal: spacing.sm + 4,
      paddingVertical: spacing.sm,
    },
    promptTileText: {
      ...typography.caption,
      color: theme.text,
      fontWeight: '700',
      fontSize: 10,
      letterSpacing: 0.5,
      flex: 1,
      marginRight: spacing.xs,
    },
    messagesScroll: {
      flex: 1,
    },
    messagesContent: {
      paddingHorizontal: spacing.sm + 4,
      paddingTop: spacing.sm + 4,
      paddingBottom: spacing.sm + 4,
    },
    chipsBar: {
      borderTopWidth: 1,
      borderTopColor: theme.hairline || theme.border,
      backgroundColor: theme.background,
      paddingVertical: 5,
    },
    chipsScroll: {
      paddingHorizontal: spacing.sm + 4,
      gap: spacing.xs,
    },
    chipPill: {
      borderWidth: 1,
      borderColor: theme.hairline || theme.border,
      borderRadius: 2,
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
      backgroundColor: theme.card || theme.surface,
    },
    chipPillText: {
      ...typography.caption,
      color: theme.text,
      fontSize: 9,
      fontWeight: '700',
      letterSpacing: 0.8,
    },
  });
