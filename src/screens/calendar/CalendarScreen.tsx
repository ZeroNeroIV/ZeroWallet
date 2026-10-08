// Simplizum Financial Calendar — Multi-Horizon Month Schedule & Daily Event Ledger
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { format, addMonths, subMonths, isToday, isSameMonth } from 'date-fns';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';
import { useThemeColors } from '../../hooks/useThemeColors';
import { formatCurrency } from '../../utils/currencyFormatter';
import { triggerHaptic } from '../../services/haptics/hapticFeedback';
import { borderRadius } from '../../theme/spacing';
import { MonthCalendarGrid } from '../../components/calendar/MonthCalendarGrid';
import {
  CalendarService,
  type MonthCalendarData,
  type DayCalendarData,
  type CalendarItem,
} from '../../services/calendar/calendarService';
import type { MainStackParamList } from '../../types/navigation';
import { CategoryIcon } from '../../components/transactions/CategoryIcon';

type NavProp = StackNavigationProp<MainStackParamList, 'Calendar'>;
type RouteProps = RouteProp<MainStackParamList, 'Calendar'>;
type FilterType = 'all' | 'transactions' | 'bills' | 'subscriptions' | 'upcoming';

export const CalendarScreen: React.FC = () => {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RouteProps>();
  const insets = useSafeAreaInsets();
  const themeColors = useThemeColors();

  const { currentAccountId, currentUser } = useAuthStore();
  const isBalanceHidden = useUIStore((s) => s.isBalanceHidden);
  const toggleBalanceHidden = useUIStore((s) => s.toggleBalanceHidden);

  // Initial date from params (if passed) or today
  const initialDate = useMemo(() => {
    return route.params?.initialDate ? new Date(route.params.initialDate) : new Date();
  }, [route.params?.initialDate]);

  const [currentMonthDate, setCurrentMonthDate] = useState<Date>(initialDate);
  const [selectedDateKey, setSelectedDateKey] = useState<string>(format(initialDate, 'yyyy-MM-dd'));
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [monthData, setMonthData] = useState<MonthCalendarData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const calendarService = useMemo(() => new CalendarService(), []);

  // Fetch month data from database
  const loadCalendarData = useCallback(async () => {
    if (!currentAccountId || !currentUser) return;
    try {
      const data = await calendarService.getMonthData(
        currentAccountId,
        currentUser.id,
        currentMonthDate
      );
      setMonthData(data);

      // If selectedDateKey is not in the loaded daysMap (e.g. switched month), select 1st of month or today if same month
      if (!data.daysMap[selectedDateKey]) {
        if (isSameMonth(new Date(), currentMonthDate)) {
          setSelectedDateKey(format(new Date(), 'yyyy-MM-dd'));
        } else {
          const firstKey = format(data.monthDate, 'yyyy-MM-01');
          setSelectedDateKey(firstKey);
        }
      }
    } catch (err) {
      console.error('[CalendarScreen] Failed to load month data:', err);
    } finally {
      setLoading(false);
    }
  }, [currentAccountId, currentUser, currentMonthDate, calendarService, selectedDateKey]);

  useEffect(() => {
    loadCalendarData();
  }, [currentMonthDate, loadCalendarData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadCalendarData();
    setRefreshing(false);
  };

  // Month navigation handlers
  const handlePrevMonth = () => {
    triggerHaptic('selection');
    setCurrentMonthDate((prev) => subMonths(prev, 1));
  };

  const handleNextMonth = () => {
    triggerHaptic('selection');
    setCurrentMonthDate((prev) => addMonths(prev, 1));
  };

  const handleJumpToToday = () => {
    triggerHaptic('selection');
    const today = new Date();
    setCurrentMonthDate(today);
    setSelectedDateKey(format(today, 'yyyy-MM-dd'));
  };

  // Day selection from grid
  const handleSelectDay = (day: DayCalendarData) => {
    setSelectedDateKey(day.dateKey);
    // If selected day is from another month (padding day), navigate to that month
    if (!day.isCurrentMonth) {
      setCurrentMonthDate(day.date);
    }
  };

  // Get active selected day data
  const selectedDayData: DayCalendarData | undefined = useMemo(() => {
    return monthData?.daysMap[selectedDateKey];
  }, [monthData, selectedDateKey]);

  // Filter day items based on active filter chip
  const filteredDayItems = useMemo(() => {
    if (!selectedDayData) return [];
    return selectedDayData.items.filter((item) => {
      if (filterType === 'transactions') return item.type === 'transaction';
      if (filterType === 'bills') return item.type === 'recurring';
      if (filterType === 'subscriptions') return item.type === 'subscription';
      if (filterType === 'upcoming') return item.isUpcoming;
      return true;
    });
  }, [selectedDayData, filterType]);

  // Pay upcoming recurring item action
  const handlePayRecurring = (item: CalendarItem) => {
    if (!currentAccountId || !monthData) return;
    const isSub = item.type === 'subscription';
    const label = isSub ? 'Subscription' : 'Recurring Bill';

    Alert.alert(
      `Pay ${label}`,
      `Record a ${formatCurrency(item.amount, monthData.currency)} payment for "${item.title}" now?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Pay & Advance Schedule',
          onPress: async () => {
            try {
              triggerHaptic('selection');
              await calendarService.payRecurringItem(
                currentAccountId,
                item,
                monthData.currency
              );
              triggerHaptic('notificationSuccess');
              await loadCalendarData();
            } catch (err: any) {
              Alert.alert('Payment Error', err?.message || 'Failed to record payment.');
            }
          },
        },
      ]
    );
  };

  // Add transaction on selected date
  const handleAddTransactionOnDate = () => {
    triggerHaptic('selection');
    const targetDateMs = selectedDayData ? selectedDayData.date.getTime() : Date.now();
    navigation.navigate('AddTransaction', { initialDate: targetDateMs });
  };

  const isCurrentMonthView = isSameMonth(new Date(), currentMonthDate);
  const isSelectedToday = selectedDateKey === format(new Date(), 'yyyy-MM-dd');

  return (
    <View style={[styles.root, { backgroundColor: themeColors.background }]}>
      {/* 1. Simplizum Precision Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: Math.max(insets.top, 16),
            borderBottomColor: themeColors.hairline,
            backgroundColor: themeColors.background,
          },
        ]}
      >
        <View style={styles.headerLeft}>
          <TouchableOpacity
            style={[
              styles.iconBtn,
              {
                borderColor: themeColors.hairline,
                backgroundColor: themeColors.surface,
              },
            ]}
            onPress={() => {
              triggerHaptic('selection');
              navigation.goBack();
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Back"
          >
            <MaterialCommunityIcons name="arrow-left" size={18} color={themeColors.text} />
          </TouchableOpacity>
          <View>
            <Text style={[styles.headerSuper, { color: themeColors.textMuted }]}>
              ZERO WALLET · SCHEDULE
            </Text>
            <Text style={[styles.headerTitle, { color: themeColors.text }]}>CALENDAR</Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          {/* Today Quick Jump Button */}
          {(!isCurrentMonthView || !isSelectedToday) && (
            <TouchableOpacity
              style={[
                styles.todayPill,
                {
                  borderColor: themeColors.hairline,
                  backgroundColor: themeColors.surface,
                },
              ]}
              onPress={handleJumpToToday}
              activeOpacity={0.7}
            >
              <Text style={[styles.todayPillText, { color: themeColors.primary }]}>TODAY</Text>
            </TouchableOpacity>
          )}

          {/* Eye Privacy Toggle */}
          <TouchableOpacity
            style={[
              styles.iconBtn,
              {
                borderColor: themeColors.hairline,
                backgroundColor: themeColors.surface,
              },
            ]}
            onPress={() => {
              triggerHaptic('selection');
              toggleBalanceHidden();
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.7}
            accessibilityLabel="Toggle Balance Visibility"
          >
            <MaterialCommunityIcons
              name={isBalanceHidden ? 'eye-off-outline' : 'eye-outline'}
              size={18}
              color={themeColors.text}
            />
          </TouchableOpacity>

          {/* Quick Add Transaction Button */}
          <TouchableOpacity
            style={[
              styles.iconBtn,
              styles.addBtn,
              {
                borderColor: themeColors.primary,
                backgroundColor: themeColors.primary,
              },
            ]}
            onPress={handleAddTransactionOnDate}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.8}
            accessibilityLabel="Add Transaction"
          >
            <MaterialCommunityIcons name="plus" size={18} color={themeColors.onPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Platform.OS === 'ios' ? 100 : 80 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={themeColors.text}
          />
        }
      >
        {/* 2. Month Navigator Bar */}
        <View
          style={[
            styles.monthNavigator,
            {
              backgroundColor: themeColors.surface,
              borderColor: themeColors.hairline,
            },
          ]}
        >
          <TouchableOpacity
            style={[styles.monthNavBtn, { borderColor: themeColors.hairline }]}
            onPress={handlePrevMonth}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="chevron-left" size={20} color={themeColors.text} />
          </TouchableOpacity>

          <View style={styles.monthTitleContainer}>
            <Text style={[styles.monthTitleText, { color: themeColors.text }]}>
              {monthData?.monthTitle || format(currentMonthDate, 'MMMM yyyy').toUpperCase()}
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.monthNavBtn, { borderColor: themeColors.hairline }]}
            onPress={handleNextMonth}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="chevron-right" size={20} color={themeColors.text} />
          </TouchableOpacity>
        </View>

        {/* 3. Monthly Financial Summary Bar (4-Pill Bento) */}
        {monthData && (
          <View
            style={[
              styles.summaryBar,
              {
                backgroundColor: themeColors.surface,
                borderColor: themeColors.cardBorder,
              },
            ]}
          >
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryLabel, { color: themeColors.textMuted }]}>INCOME</Text>
              <Text style={[styles.summaryValue, { color: '#10B981' }]}>
                {isBalanceHidden
                  ? '••••'
                  : `+${formatCurrency(monthData.totalIncome, monthData.currency)}`}
              </Text>
            </View>

            <View style={[styles.summaryDivider, { backgroundColor: themeColors.hairline }]} />

            <View style={styles.summaryItem}>
              <Text style={[styles.summaryLabel, { color: themeColors.textMuted }]}>EXPENSES</Text>
              <Text style={[styles.summaryValue, { color: themeColors.error }]}>
                {isBalanceHidden
                  ? '••••'
                  : `-${formatCurrency(monthData.totalExpense, monthData.currency)}`}
              </Text>
            </View>

            <View style={[styles.summaryDivider, { backgroundColor: themeColors.hairline }]} />

            <View style={styles.summaryItem}>
              <Text style={[styles.summaryLabel, { color: themeColors.textMuted }]}>UPCOMING</Text>
              <Text style={[styles.summaryValue, { color: '#F59E0B' }]}>
                {isBalanceHidden
                  ? '••••'
                  : formatCurrency(monthData.totalUpcomingCommitments, monthData.currency)}
              </Text>
            </View>

            <View style={[styles.summaryDivider, { backgroundColor: themeColors.hairline }]} />

            <View style={styles.summaryItem}>
              <Text style={[styles.summaryLabel, { color: themeColors.textMuted }]}>
                EST. NET
              </Text>
              <Text
                style={[
                  styles.summaryValue,
                  {
                    color: monthData.projectedNet >= 0 ? '#10B981' : themeColors.error,
                  },
                ]}
              >
                {isBalanceHidden
                  ? '••••'
                  : `${monthData.projectedNet >= 0 ? '+' : ''}${formatCurrency(
                      monthData.projectedNet,
                      monthData.currency
                    )}`}
              </Text>
            </View>
          </View>
        )}

        {/* 4. Month Calendar Grid */}
        {loading && !refreshing ? (
          <View style={styles.centerLoading}>
            <ActivityIndicator color={themeColors.text} size="small" />
          </View>
        ) : monthData ? (
          <MonthCalendarGrid
            gridDays={monthData.gridDays}
            selectedDateKey={selectedDateKey}
            onSelectDay={handleSelectDay}
          />
        ) : null}

        {/* 5. Event Legend Rail */}
        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#10B981' }]} />
            <Text style={[styles.legendText, { color: themeColors.textMuted }]}>Income</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: themeColors.error }]} />
            <Text style={[styles.legendText, { color: themeColors.textMuted }]}>Expense</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#F59E0B' }]} />
            <Text style={[styles.legendText, { color: themeColors.textMuted }]}>Bill</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#8B5CF6' }]} />
            <Text style={[styles.legendText, { color: themeColors.textMuted }]}>Subscription</Text>
          </View>
        </View>

        {/* 6. Filter Chips Rail */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterChipsScroll}
        >
          {(
            [
              { key: 'all', label: 'ALL EVENTS' },
              { key: 'transactions', label: 'TRANSACTIONS' },
              { key: 'bills', label: 'BILLS' },
              { key: 'subscriptions', label: 'SUBSCRIPTIONS' },
              { key: 'upcoming', label: 'UPCOMING DUE' },
            ] as Array<{ key: FilterType; label: string }>
          ).map((chip) => {
            const isSelected = filterType === chip.key;
            return (
              <TouchableOpacity
                key={chip.key}
                activeOpacity={0.7}
                onPress={() => {
                  triggerHaptic('selection');
                  setFilterType(chip.key);
                }}
                style={[
                  styles.chip,
                  {
                    borderColor: isSelected ? themeColors.text : themeColors.hairline,
                    backgroundColor: isSelected ? themeColors.text : themeColors.background,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    {
                      color: isSelected ? themeColors.background : themeColors.text,
                    },
                  ]}
                >
                  {chip.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* 7. Selected Day Header & Activity Ledger */}
        <View style={styles.daySectionHeader}>
          <View>
            <Text style={[styles.daySectionDate, { color: themeColors.text }]}>
              {selectedDayData
                ? format(selectedDayData.date, 'EEEE, MMMM d, yyyy').toUpperCase()
                : 'SELECTED DAY'}
            </Text>
            {selectedDayData && (
              <Text style={[styles.daySectionSub, { color: themeColors.textMuted }]}>
                {selectedDayData.items.length}{' '}
                {selectedDayData.items.length === 1 ? 'EVENT' : 'EVENTS'} SCHEDULED
              </Text>
            )}
          </View>

          <TouchableOpacity
            style={[
              styles.dayAddBtn,
              {
                borderColor: themeColors.hairline,
                backgroundColor: themeColors.surface,
              },
            ]}
            onPress={handleAddTransactionOnDate}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="plus" size={14} color={themeColors.text} />
            <Text style={[styles.dayAddBtnText, { color: themeColors.text }]}>ADD</Text>
          </TouchableOpacity>
        </View>

        {/* 8. Items List for Selected Day */}
        {filteredDayItems.length === 0 ? (
          <View
            style={[
              styles.emptyCard,
              {
                backgroundColor: themeColors.surface,
                borderColor: themeColors.cardBorder,
              },
            ]}
          >
            <MaterialCommunityIcons
              name="calendar-blank-outline"
              size={32}
              color={themeColors.textMuted}
              style={{ marginBottom: 8 }}
            />
            <Text style={[styles.emptyTitle, { color: themeColors.text }]}>
              No scheduled events on this date
            </Text>
            <Text style={[styles.emptySubtitle, { color: themeColors.textMuted }]}>
              Transactions, bills, and subscriptions will appear here.
            </Text>
            <TouchableOpacity
              style={[
                styles.emptyActionBtn,
                {
                  borderColor: themeColors.primary,
                  backgroundColor: themeColors.primary,
                },
              ]}
              onPress={handleAddTransactionOnDate}
              activeOpacity={0.8}
            >
              <Text style={[styles.emptyActionText, { color: themeColors.onPrimary }]}>
                + Log Transaction for this Day
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View
            style={[
              styles.itemsContainer,
              {
                backgroundColor: themeColors.surface,
                borderColor: themeColors.cardBorder,
              },
            ]}
          >
            {filteredDayItems.map((item, idx) => {
              const isLast = idx === filteredDayItems.length - 1;
              const isTx = item.type === 'transaction';
              const isSub = item.type === 'subscription';
              const isRec = item.type === 'recurring';
              const currency = monthData?.currency || 'USD';

              return (
                <View
                  key={item.id}
                  style={[
                    styles.itemRow,
                    !isLast && {
                      borderBottomWidth: 1,
                      borderBottomColor: themeColors.hairline,
                    },
                  ]}
                >
                  {/* Left: Icon Badge */}
                  <View style={styles.itemIconContainer}>
                    {isTx ? (
                      <CategoryIcon
                        icon={item.category?.icon || 'cash'}
                        color={item.category?.color || themeColors.primary}
                        size="small"
                      />
                    ) : isSub ? (
                      <View
                        style={[
                          styles.badgeIconBox,
                          { backgroundColor: 'rgba(139, 92, 246, 0.15)' },
                        ]}
                      >
                        <MaterialCommunityIcons
                          name="repeat-variant"
                          size={18}
                          color="#8B5CF6"
                        />
                      </View>
                    ) : (
                      <View
                        style={[
                          styles.badgeIconBox,
                          { backgroundColor: 'rgba(245, 158, 11, 0.15)' },
                        ]}
                      >
                        <MaterialCommunityIcons
                          name="calendar-clock-outline"
                          size={18}
                          color="#F59E0B"
                        />
                      </View>
                    )}
                  </View>

                  {/* Middle: Info */}
                  <TouchableOpacity
                    style={styles.itemInfo}
                    activeOpacity={isTx ? 0.7 : 1}
                    onPress={() => {
                      if (isTx && item.transaction) {
                        triggerHaptic('selection');
                        navigation.navigate('TransactionDetails', {
                          transactionId: item.transaction.id,
                        });
                      }
                    }}
                  >
                    <View style={styles.itemTitleRow}>
                      <Text
                        style={[styles.itemTitle, { color: themeColors.text }]}
                        numberOfLines={1}
                      >
                        {item.title}
                      </Text>

                      {/* Status Badges */}
                      {isSub && (
                        <View
                          style={[
                            styles.microBadge,
                            {
                              backgroundColor: item.isPaid
                                ? 'rgba(16, 185, 129, 0.12)'
                                : 'rgba(139, 92, 246, 0.12)',
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.microBadgeText,
                              { color: item.isPaid ? '#10B981' : '#8B5CF6' },
                            ]}
                          >
                            {item.isPaid ? 'RENEWED' : 'SUBSCRIPTION'}
                          </Text>
                        </View>
                      )}

                      {isRec && (
                        <View
                          style={[
                            styles.microBadge,
                            {
                              backgroundColor: item.isPaid
                                ? 'rgba(16, 185, 129, 0.12)'
                                : 'rgba(245, 158, 11, 0.12)',
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.microBadgeText,
                              { color: item.isPaid ? '#10B981' : '#F59E0B' },
                            ]}
                          >
                            {item.isPaid ? 'PROCESSED' : 'RECURRING BILL'}
                          </Text>
                        </View>
                      )}
                    </View>

                    <Text style={[styles.itemSub, { color: themeColors.textMuted }]}>
                      {isTx
                        ? `${item.walletName || 'Wallet'} • ${item.timeFormatted || ''}`
                        : `${item.cadenceDescription || item.frequencyLabel || ''} • ${
                            item.walletName || 'Wallet'
                          }`}
                      {item.isUpcoming &&
                        (item.daysUntil === 0
                          ? ' • Due Today'
                          : item.daysUntil! > 0
                          ? ` • Due in ${item.daysUntil}d`
                          : '')}
                    </Text>
                  </TouchableOpacity>

                  {/* Right: Amount & Action */}
                  <View style={styles.itemRight}>
                    <Text
                      style={[
                        styles.itemAmount,
                        {
                          color: isTx
                            ? item.transactionType === 'income'
                              ? '#10B981'
                              : themeColors.text
                            : themeColors.text,
                        },
                      ]}
                    >
                      {isBalanceHidden
                        ? '••••'
                        : `${
                            isTx && item.transactionType === 'income'
                              ? '+'
                              : isTx
                              ? '-'
                              : ''
                          }${formatCurrency(item.amount, currency)}`}
                    </Text>

                    {/* Pay Now Button for upcoming commitments */}
                    {(isRec || isSub) && item.isUpcoming && (
                      <TouchableOpacity
                        style={[
                          styles.payNowBtn,
                          {
                            borderColor: themeColors.hairline,
                            backgroundColor: themeColors.background,
                          },
                        ]}
                        onPress={() => handlePayRecurring(item)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.payNowText, { color: themeColors.primary }]}>
                          PAY NOW
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerSuper: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: borderRadius.xs,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtn: {
    borderWidth: 0,
  },
  todayPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: borderRadius.xs,
    borderWidth: 1,
  },
  todayPillText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 14,
  },
  monthNavigator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  monthNavBtn: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.xs,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthTitleContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthTitleText: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1,
  },
  summaryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginBottom: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 8.5,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  summaryValue: {
    fontSize: 12,
    fontWeight: '700',
  },
  summaryDivider: {
    width: 1,
    height: 20,
  },
  centerLoading: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginTop: 10,
    marginBottom: 14,
    paddingHorizontal: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  legendText: {
    fontSize: 10,
    fontWeight: '500',
  },
  filterChipsScroll: {
    paddingHorizontal: 16,
    gap: 8,
    paddingBottom: 14,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.xs,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  daySectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  daySectionDate: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  daySectionSub: {
    fontSize: 9.5,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginTop: 1,
  },
  dayAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: borderRadius.xs,
    borderWidth: 1,
  },
  dayAddBtnText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  emptyCard: {
    marginHorizontal: 16,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 11,
    textAlign: 'center',
    marginBottom: 14,
  },
  emptyActionBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: borderRadius.xs,
  },
  emptyActionText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  itemsContainer: {
    marginHorizontal: 16,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  itemIconContainer: {
    marginRight: 12,
  },
  badgeIconBox: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemInfo: {
    flex: 1,
    marginRight: 10,
  },
  itemTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  itemTitle: {
    fontSize: 13,
    fontWeight: '600',
    flexShrink: 1,
  },
  microBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 2,
  },
  microBadgeText: {
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  itemSub: {
    fontSize: 10.5,
  },
  itemRight: {
    alignItems: 'flex-end',
  },
  itemAmount: {
    fontSize: 13,
    fontWeight: '700',
  },
  payNowBtn: {
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.xs,
    borderWidth: 1,
  },
  payNowText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
