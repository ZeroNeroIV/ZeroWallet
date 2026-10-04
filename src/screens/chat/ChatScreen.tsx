/**
 * ChatScreen — Simplizum Architectural Edition
 *
 * Full-featured financial intelligence console:
 *  1. Laya System-1 Fast Decision Router (<20ms local heuristic)
 *  2. Foundation SLM/LLM Engine (Gemini 2.5 Flash, Groq Llama 3.3, Ollama)
 *  3. Architectural conversational ledger stream
 *  4. Inline actionable mutation tickets
 *  5. Horizontal micro-chips quick command bar
 *  6. Floating hairline command bar with live engine badge
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
    return new LayaVoiceService(harness, key);
  }, [aiSettings, currentAccountId, currentUser?.id, accountCurrency, totalBalance]);

  const engineNameBadge = useMemo(() => {
    const isSys1 = aiSettings?.system1Enabled !== false;
    const model = aiSettings?.selectedModel || 'gemini-3.8-flash';
    const providerName =
      aiSettings?.provider === 'groq'
        ? 'GROQ'
        : aiSettings?.provider === 'custom_openai'
        ? 'LOCAL'
        : model.includes('3.8')
        ? 'GEMINI 3.8'
        : model.includes('3.5')
        ? 'GEMINI 3.5'
        : 'GEMINI';

    return isSys1 ? `⚡ LAYA + ${providerName}` : providerName;
  }, [aiSettings]);

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

        addMessage(
          'assistant',
          response.text,
          false,
          pendingActionId,
          response.widgets,
          response.engineBadge
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
    [currentAccountId, currentUser, accountCurrency, totalBalance, aiSettings, messages, navigation, addMessage, addPendingAction, setLoading, setError, settingsStore]
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
      {/* Architectural Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => {
              lightHaptic();
              navigation.goBack();
            }}
          >
            <MaterialCommunityIcons name="arrow-left" size={18} color={themeColors.text} />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerSuper}>INTELLIGENCE AGENT</Text>
            <Text style={styles.headerTitle}>LAYA CONSOLE</Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          <View style={styles.engineBadge}>
            <Text style={styles.engineBadgeText}>{engineNameBadge}</Text>
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
            <MaterialCommunityIcons name="phone-in-talk" size={17} color={themeColors.primary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => {
              lightHaptic();
              navigation.navigate('AISettings');
            }}
          >
            <MaterialCommunityIcons name="tune" size={18} color={themeColors.text} />
          </TouchableOpacity>

          {messages.length > 0 && (
            <TouchableOpacity style={styles.actionBtn} onPress={handleClearHistory}>
              <MaterialCommunityIcons name="trash-can-outline" size={18} color={themeColors.textSecondary} />
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
                <Text style={styles.briefingSuper}>AUTONOMOUS LEDGER COPILOT</Text>
                <Text style={styles.briefingTitle}>ZERO WALLET · LAYA OS</Text>
              </View>

              <Text style={styles.briefingBody}>
                Hybrid financial intelligence: Sub-20ms local intent classifier for instant transaction
                logging + deep reasoning foundation models for cash flow planning.
              </Text>

              {/* Specs Table */}
              <View style={styles.specsTable}>
                <View style={styles.specRow}>
                  <Text style={styles.specLabel}>SYSTEM-1 DISPATCH</Text>
                  <Text style={styles.specVal}>&lt;20MS LOCAL</Text>
                </View>
                <View style={styles.specDivider} />
                <View style={styles.specRow}>
                  <Text style={styles.specLabel}>MUTATION SAFETY</Text>
                  <Text style={styles.specVal}>EXPLICIT AUDIT TICKET</Text>
                </View>
                <View style={styles.specDivider} />
                <View style={styles.specRow}>
                  <Text style={styles.specLabel}>REASONING ENGINE</Text>
                  <Text style={styles.specVal}>GEMINI 2.5 / GROQ</Text>
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
                  <Text style={styles.promptTileText}>{chip.label}</Text>
                  <MaterialCommunityIcons name="arrow-top-right" size={14} color={themeColors.textSecondary} />
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
                <Text style={styles.chipPillText}>{chip.label}</Text>
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

      {/* LAYA Live Voice Call Modal */}
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
            [widget]
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
      paddingHorizontal: spacing.md,
      paddingTop: spacing.xl,
      paddingBottom: spacing.sm + 4,
      borderBottomWidth: 1,
      borderBottomColor: theme.hairline || theme.border,
      backgroundColor: theme.card || theme.surface,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    backButton: {
      width: 32,
      height: 32,
      borderWidth: 1,
      borderColor: theme.hairline || theme.border,
      borderRadius: 2,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.background,
    },
    headerSuper: {
      ...typography.caption,
      color: theme.textSecondary,
      fontSize: 9,
      letterSpacing: 1.5,
      fontWeight: '700',
    },
    headerTitle: {
      ...typography.h3,
      color: theme.text,
      letterSpacing: 0.5,
      fontWeight: '700',
    },
    headerRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs + 2,
    },
    engineBadge: {
      borderWidth: 1,
      borderColor: theme.hairline || theme.border,
      paddingHorizontal: spacing.xs + 2,
      paddingVertical: 3,
      borderRadius: 2,
      backgroundColor: theme.background,
    },
    engineBadgeText: {
      ...typography.caption,
      color: theme.text,
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 0.5,
      fontFamily: 'monospace',
    },
    actionBtn: {
      width: 32,
      height: 32,
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
      padding: spacing.md,
      paddingTop: spacing.lg,
    },
    briefingCard: {
      borderWidth: 1,
      borderColor: theme.hairline || theme.border,
      backgroundColor: theme.card || theme.surface,
      borderRadius: 2,
      padding: spacing.md,
      marginBottom: spacing.lg,
    },
    briefingHeader: {
      marginBottom: spacing.xs,
    },
    briefingSuper: {
      ...typography.caption,
      color: theme.textSecondary,
      fontSize: 9,
      fontWeight: '700',
      letterSpacing: 1.2,
      marginBottom: 2,
    },
    briefingTitle: {
      ...typography.h3,
      color: theme.text,
      fontWeight: '700',
      letterSpacing: 0.5,
    },
    briefingBody: {
      ...typography.body,
      color: theme.textSecondary,
      fontSize: 12,
      lineHeight: 18,
      marginBottom: spacing.md,
    },
    specsTable: {
      borderTopWidth: 1,
      borderTopColor: theme.hairline || theme.border,
      paddingTop: spacing.xs,
    },
    specRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 5,
    },
    specDivider: {
      borderTopWidth: 1,
      borderTopColor: theme.hairline || theme.border,
    },
    specLabel: {
      ...typography.caption,
      color: theme.textSecondary,
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 0.8,
    },
    specVal: {
      ...typography.caption,
      color: theme.text,
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 0.5,
      fontFamily: 'monospace',
    },
    emptyPromptsTitle: {
      ...typography.caption,
      color: theme.textSecondary,
      fontSize: 10,
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
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 2,
    },
    promptTileText: {
      ...typography.caption,
      color: theme.text,
      fontWeight: '700',
      fontSize: 11,
      letterSpacing: 0.5,
    },
    messagesScroll: {
      flex: 1,
    },
    messagesContent: {
      paddingHorizontal: spacing.md,
      paddingTop: spacing.md,
      paddingBottom: spacing.md,
    },
    chipsBar: {
      borderTopWidth: 1,
      borderTopColor: theme.hairline || theme.border,
      backgroundColor: theme.background,
      paddingVertical: 6,
    },
    chipsScroll: {
      paddingHorizontal: spacing.md,
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
