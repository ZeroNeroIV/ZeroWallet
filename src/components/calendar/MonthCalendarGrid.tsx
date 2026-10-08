// Simplizum Month Calendar Grid — Crisp 7-Column Architectural Grid with Multi-Color Event Badges
import React, { memo, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, useWindowDimensions } from 'react-native';
import { useThemeColors } from '../../hooks/useThemeColors';
import { triggerHaptic } from '../../services/haptics/hapticFeedback';
import { borderRadius } from '../../theme/spacing';
import type { DayCalendarData } from '../../services/calendar/calendarService';

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

interface MonthCalendarGridProps {
  gridDays: DayCalendarData[];
  selectedDateKey: string;
  onSelectDay: (day: DayCalendarData) => void;
}

export const MonthCalendarGrid: React.FC<MonthCalendarGridProps> = memo(
  ({ gridDays, selectedDateKey, onSelectDay }) => {
    const themeColors = useThemeColors();
    const { width: screenWidth } = useWindowDimensions();

    const handleDayPress = useCallback(
      (day: DayCalendarData) => {
        triggerHaptic('selection');
        onSelectDay(day);
      },
      [onSelectDay]
    );

    // Grid container padding: 16 on each side
    const availableWidth = screenWidth - 32;
    const cellWidth = Math.floor(availableWidth / 7);

    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: themeColors.surface,
            borderColor: themeColors.hairline,
          },
        ]}
      >
        {/* Weekday Labels Header */}
        <View
          style={[
            styles.weekdayHeaderRow,
            {
              borderBottomColor: themeColors.hairline,
              backgroundColor: themeColors.background,
            },
          ]}
        >
          {WEEKDAYS.map((day) => (
            <View key={day} style={[styles.weekdayCell, { width: cellWidth }]}>
              <Text style={[styles.weekdayText, { color: themeColors.textMuted }]}>{day}</Text>
            </View>
          ))}
        </View>

        {/* 7-Column Days Grid */}
        <View style={styles.daysGrid}>
          {gridDays.map((day) => {
            const isSelected = day.dateKey === selectedDateKey;
            const isToday = day.isToday;
            const isCurrentMonth = day.isCurrentMonth;

            // Determine text color for day number
            let dayTextColor = isCurrentMonth ? themeColors.text : themeColors.textDisabled;
            if (isSelected) {
              dayTextColor = themeColors.onPrimary;
            } else if (isToday) {
              dayTextColor = themeColors.primary;
            }

            return (
              <TouchableOpacity
                key={day.dateKey}
                style={[
                  styles.dayCell,
                  { width: cellWidth },
                  isSelected && [
                    styles.selectedCell,
                    {
                      backgroundColor: themeColors.text,
                      borderColor: themeColors.text,
                    },
                  ],
                  !isSelected &&
                    isToday && [
                      styles.todayCell,
                      {
                        borderColor: themeColors.primary,
                      },
                    ],
                ]}
                activeOpacity={0.7}
                onPress={() => handleDayPress(day)}
                accessibilityLabel={`${day.dayNumber} ${day.isCurrentMonth ? '' : 'outside month'}`}
                accessibilityRole="button"
              >
                {/* Day Number */}
                <View style={styles.dayNumberContainer}>
                  <Text
                    style={[
                      styles.dayNumberText,
                      { color: dayTextColor },
                      (isSelected || isToday) && styles.dayNumberBold,
                    ]}
                  >
                    {day.dayNumber}
                  </Text>
                </View>

                {/* Event Dot Indicators */}
                <View style={styles.dotRow}>
                  {day.hasIncome && (
                    <View
                      style={[
                        styles.dot,
                        {
                          backgroundColor: isSelected ? themeColors.onPrimary : '#10B981',
                        },
                      ]}
                    />
                  )}
                  {day.hasExpense && (
                    <View
                      style={[
                        styles.dot,
                        {
                          backgroundColor: isSelected ? themeColors.onPrimary : themeColors.error,
                        },
                      ]}
                    />
                  )}
                  {day.hasRecurring && (
                    <View
                      style={[
                        styles.dot,
                        {
                          backgroundColor: isSelected ? themeColors.onPrimary : '#F59E0B',
                        },
                      ]}
                    />
                  )}
                  {day.hasSubscription && (
                    <View
                      style={[
                        styles.dot,
                        {
                          backgroundColor: isSelected ? themeColors.onPrimary : '#8B5CF6',
                        },
                      ]}
                    />
                  )}
                </View>

                {/* Micro Indicator for Upcoming Commitment */}
                {day.hasUpcoming && !isSelected && (
                  <View
                    style={[
                      styles.upcomingTick,
                      { backgroundColor: '#F59E0B' },
                    ]}
                  />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  weekdayHeaderRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    paddingVertical: 8,
  },
  weekdayCell: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekdayText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  selectedCell: {
    borderRadius: borderRadius.xs,
  },
  todayCell: {
    borderWidth: 1,
    borderRadius: borderRadius.xs,
  },
  dayNumberContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNumberText: {
    fontSize: 13,
    fontWeight: '500',
  },
  dayNumberBold: {
    fontWeight: '700',
  },
  dotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2.5,
    marginTop: 3,
    height: 5,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  upcomingTick: {
    position: 'absolute',
    top: 3,
    right: 3,
    width: 3.5,
    height: 3.5,
    borderRadius: 2,
  },
});
