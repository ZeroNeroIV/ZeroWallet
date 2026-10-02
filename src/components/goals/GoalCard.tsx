/**
 * Purpose: Simplizum GoalCard wrapper for backward compatibility and clean architecture.
 */

import React from 'react';
import { GoalArchitecturalCard } from './GoalArchitecturalCard';
import type { Goal } from '../../types/models';

interface GoalCardProps {
  goal: Goal;
  onPress: () => void;
  onLongPress?: () => void;
  accountCurrency?: string;
  onFundPress?: (goal: Goal) => void;
  onEditPress?: (goal: Goal) => void;
}

export const GoalCard: React.FC<GoalCardProps> = ({
  goal,
  onPress,
  accountCurrency = 'USD',
  onFundPress,
  onEditPress,
}) => {
  return (
    <GoalArchitecturalCard
      goal={goal}
      currency={accountCurrency}
      onFundPress={onFundPress || (() => onPress())}
      onEditPress={onEditPress || (() => onPress())}
    />
  );
};
