/**
 * Purpose: Main AI chat screen for conversing with Gemini assistant
 *
 * Inputs:
 *   - navigation (ChatScreenProps): Navigation object from React Navigation
 *
 * Outputs:
 *   - Returns (JSX.Element): Full chat interface with messages and input
 *
 * Side effects:
 *   - Fetches and sends messages to Gemini API
 *   - Updates message history in aiChatStore
 *   - Updates usage statistics in settingsStore
 *   - Scrolls to latest message
 *   - Handles keyboard events
 */

import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  RefreshControl,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAIChatStore } from '../../store/aiChatStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useAuthStore } from '../../store/authStore';
import { MessageBubble } from '../../components/chat/MessageBubble';
import { ChatInput } from '../../components/chat/ChatInput';
import { TypingIndicator } from '../../components/chat/TypingIndicator';
import { GeminiService } from '../../services/ai/geminiService';
import { ChatContextManager } from '../../services/ai/chatContextManager';
import { spacing, borderRadius } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { useThemeColors } from '../../hooks/useThemeColors';
import { lightHaptic } from '../../services/haptics/hapticFeedback';
import type { AIMessage } from '../../types/ai';

// Example prompts for empty state
const EXAMPLE_PROMPTS = [
  "What's my current balance?",
  'Show me my spending this month',
  'How am I doing with my savings goals?',
  'What are my upcoming subscriptions?',
];

const ChatScreen = ({ navigation }: any) => {
  const themeColors = useThemeColors();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);

  // State
  const { messages, isLoading, addMessage, clearMessages, setLoading, setError, addPendingAction } =
    useAIChatStore();
  const settingsStore = useSettingsStore();
  const aiSettings = settingsStore.aiSettings || {
    apiKey: null,
    selectedModel: 'gemini-2.5-flash',
    isConfigured: false,
    totalTokensUsed: 0,
    conversationCount: 0,
    lastUsed: null
  };
  const updateAISettings = settingsStore.updateAISettings;
  const { currentAccountId, currentUser } = useAuthStore();

  const flatListRef = useRef<FlatList>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Scroll to bottom when new message arrives
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

  // Handle sending message
  const handleSend = useCallback(
    async (text: string) => {
      if (!currentAccountId || !currentUser?.id) {
        Alert.alert('Error', 'No account or user selected');
        return;
      }

      if (!aiSettings.apiKey) {
        Alert.alert(
          'API Key Required',
          'Please configure your Gemini API key in settings first.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Go to Settings',
              onPress: () => navigation.navigate('AISettings'),
            },
          ]
        );
        return;
      }

      try {
        // Add user message immediately
        addMessage('user', text);
        setLoading(true);
        setError(null);

        // Build conversation context
        const context = await ChatContextManager.buildContext(messages, currentAccountId);

        // Create Gemini service
        const geminiService = new GeminiService(
          aiSettings.apiKey,
          currentAccountId,
          currentUser?.id || '',
          aiSettings.selectedModel
        );

        // Send message and get response
        const response = await geminiService.sendMessage(text, context);

        // Handle pending actions if any
        let pendingActionId: string | undefined;
        if (response.pendingActions && response.pendingActions.length > 0) {
          // Add all pending actions to store
          response.pendingActions.forEach((action) => {
            addPendingAction(action);
            console.log('[ChatScreen] Added pending action:', action.id);
          });
          // Use the first pending action ID for the message
          pendingActionId = response.pendingActions[0].id;
        }

        // Add AI response (linked to pending action if exists)
        addMessage('assistant', response.text, false, pendingActionId);

        // Update usage statistics
        updateAISettings({
          conversationCount: aiSettings.conversationCount + 1,
          lastUsed: Date.now(),
        });
      } catch (error: any) {
        console.error('[ChatScreen] Error sending message:', error);

        const errorMessage =
          error.message || 'Failed to get response from AI. Please try again.';

        // Show error to user
        Alert.alert('Error', errorMessage, [
          { text: 'OK', style: 'cancel' },
          {
            text: 'Check Settings',
            onPress: () => navigation.navigate('AISettings'),
          },
        ]);

        // Add error message to chat
        addMessage('assistant', `Error: ${errorMessage}`, true);
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    },
    [
      currentAccountId,
      currentUser,
      aiSettings,
      messages,
      addMessage,
      addPendingAction,
      setLoading,
      setError,
      updateAISettings,
      navigation,
    ]
  );

  // Handle example prompt tap
  const handleExamplePromptPress = useCallback(
    (prompt: string) => {
      lightHaptic();
      handleSend(prompt);
    },
    [handleSend]
  );

  // Handle pull-to-refresh (clear conversation)
  const handleRefresh = useCallback(() => {
    setRefreshing(true);

    Alert.alert(
      'Clear Conversation',
      'Are you sure you want to clear all messages? This cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => setRefreshing(false),
        },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            clearMessages();
            setRefreshing(false);
          },
        },
      ]
    );
  }, [clearMessages]);

  // Format date separator
  const formatDateSeparator = (timestamp: number): string => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const isToday = date.toDateString() === today.toDateString();
    const isYesterday = date.toDateString() === yesterday.toDateString();

    if (isToday) return 'Today';
    if (isYesterday) return 'Yesterday';

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
    });
  };

  // Group messages by date
  const messagesWithDates = useMemo(() => {
    const grouped: Array<AIMessage | { type: 'date'; date: string; id: string }> = [];
    let lastDate: string | null = null;

    // Process chronologically (oldest to newest)
    messages.forEach((message) => {
      const messageDate = formatDateSeparator(message.timestamp);

      if (messageDate !== lastDate) {
        grouped.push({
          type: 'date',
          date: messageDate,
          id: `date-${message.timestamp}`,
        });
        lastDate = messageDate;
      }

      grouped.push(message);
    });

    return grouped;
  }, [messages]);

  // Render message or date separator
  const renderItem = useCallback(
    ({ item }: { item: any }) => {
      if (item.type === 'date') {
        return (
          <View style={styles.dateSeparatorContainer}>
            <View style={styles.dateSeparatorLine} />
            <Text style={styles.dateSeparatorText}>{item.date}</Text>
            <View style={styles.dateSeparatorLine} />
          </View>
        );
      }

      return <MessageBubble message={item} />;
    },
    [styles]
  );

  // Render empty state
  const renderEmptyState = () => {
    if (isLoading) return null;

    return (
      <View style={styles.emptyStateContainer}>
        <View style={styles.emptyIconContainer}>
          <MaterialCommunityIcons
            name="robot-outline"
            size={64}
            color={themeColors.primary}
          />
        </View>

        <Text style={styles.emptyTitle}>AI Financial Assistant</Text>
        <Text style={styles.emptySubtitle}>
          Ask me anything about your finances, spending, goals, and more!
        </Text>

        <View style={styles.examplesContainer}>
          <Text style={styles.examplesTitle}>Try asking:</Text>
          {EXAMPLE_PROMPTS.map((prompt, index) => (
            <TouchableOpacity
              key={index}
              style={styles.examplePromptButton}
              onPress={() => handleExamplePromptPress(prompt)}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons
                name="message-text-outline"
                size={18}
                color={themeColors.primary}
              />
              <Text style={styles.examplePromptText}>{prompt}</Text>
              <MaterialCommunityIcons
                name="chevron-right"
                size={18}
                color={themeColors.textSecondary}
              />
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  // Render list footer (typing indicator at top since list is inverted)
  const renderListFooter = () => {
    return <TypingIndicator isVisible={isLoading} />;
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={styles.container}>
        {/* Messages List */}
        <FlatList
          ref={flatListRef}
          data={messagesWithDates}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.listContent,
            messages.length === 0 && styles.listContentEmpty,
          ]}
          ListEmptyComponent={renderEmptyState}
          ListFooterComponent={renderListFooter}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={themeColors.primary}
              colors={[themeColors.primary]}
            />
          }
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={true}
          maxToRenderPerBatch={10}
          updateCellsBatchingPeriod={50}
          initialNumToRender={10}
          windowSize={5}
        />

        {/* Chat Input */}
        <ChatInput onSend={handleSend} isLoading={isLoading} />
      </View>
    </KeyboardAvoidingView>
  );
};

const createStyles = (themeColors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: themeColors.background,
    },

    // List
    listContent: {
      flexGrow: 1,
      paddingTop: spacing.md,
    },
    listContentEmpty: {
      justifyContent: 'center',
    },

    // Date Separator
    dateSeparatorContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginVertical: spacing.lg,
      paddingHorizontal: spacing.md,
    },
    dateSeparatorLine: {
      flex: 1,
      height: 1,
      backgroundColor: themeColors.border,
    },
    dateSeparatorText: {
      ...typography.caption,
      color: themeColors.textSecondary,
      marginHorizontal: spacing.md,
      fontWeight: typography.fontWeight.medium,
    },

    // Empty State
    emptyStateContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.xl,
    },
    emptyIconContainer: {
      width: 120,
      height: 120,
      borderRadius: 60,
      backgroundColor: `${themeColors.primary}15`,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: spacing.lg,
    },
    emptyTitle: {
      ...typography.h2,
      color: themeColors.text,
      textAlign: 'center',
      marginBottom: spacing.sm,
    },
    emptySubtitle: {
      ...typography.body,
      color: themeColors.textSecondary,
      textAlign: 'center',
      marginBottom: spacing.xl,
    },

    // Examples
    examplesContainer: {
      width: '100%',
      maxWidth: 400,
    },
    examplesTitle: {
      ...typography.bodySmall,
      color: themeColors.textSecondary,
      fontWeight: typography.fontWeight.semiBold,
      marginBottom: spacing.md,
    },
    examplePromptButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: themeColors.surface,
      borderRadius: borderRadius.md,
      padding: spacing.md,
      marginBottom: spacing.sm,
      borderWidth: 1,
      borderColor: themeColors.border,
    },
    examplePromptText: {
      ...typography.body,
      color: themeColors.text,
      flex: 1,
    },
  });

export default ChatScreen;
