/**
 * Purpose: Simplizum DebtCard wrapper for backward compatibility and clean architecture.
 */

import React from 'react';
import { DebtArchitecturalCard } from './DebtArchitecturalCard';
import type { Debt } from '../../types/models';

interface DebtCardProps {
  debt: Debt;
  onPress: () => void;
  accountCurrency?: string;
  onPaymentPress?: (debt: Debt) => void;
}

export const DebtCard: React.FC<DebtCardProps> = ({
  debt,
  onPress,
  accountCurrency = 'USD',
  onPaymentPress,
}) => {
  return (
    <DebtArchitecturalCard
      debt={debt}
      currency={accountCurrency}
      onPaymentPress={onPaymentPress || (() => onPress())}
      onPress={onPress}
    />
  );
};
