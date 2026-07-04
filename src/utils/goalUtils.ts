// Goal utilities - Helper functions for goal calculations and management
import type { Goal, GoalFundingSource, AccountBalance } from '../types/models';

/**
 * Calculate the current progress of a goal based on vault balances
 */
export const calculateGoalProgress = (
    goal: Goal,
    balance: AccountBalance
): number => {
    switch (goal.fundingSource) {
        case 'main':
            return balance.mainBalance;
        case 'savings':
            return balance.savingsBalance;
        case 'both':
            return balance.mainBalance + balance.savingsBalance;
        default:
            return 0;
    }
};

/**
 * Calculate the progress percentage of a goal
 */
export const calculateGoalPercentage = (goal: Goal): number => {
    if (!goal.targetAmount || goal.targetAmount === 0) {
        return 0;
    }

    const percentage = (goal.currentAmount / goal.targetAmount) * 100;
    return Math.min(percentage, 100); // Cap at 100%
};

/**
 * Check if a goal has been reached
 */
export const isGoalReached = (goal: Goal): boolean => {
    if (!goal.targetAmount) {
        return false; // Goals without target can't be auto-completed
    }

    return goal.currentAmount >= goal.targetAmount;
};

/**
 * Get remaining amount to reach goal
 */
export const getRemainingAmount = (goal: Goal): number => {
    if (!goal.targetAmount) {
        return 0;
    }

    return Math.max(goal.targetAmount - goal.currentAmount, 0);
};

/**
 * Get color based on goal progress
 */
export const getProgressColor = (percentage: number): string => {
    if (percentage >= 100) return '#10b981'; // Green - Completed
    if (percentage >= 75) return '#f59e0b'; // Amber - Almost there
    if (percentage >= 25) return '#3b82f6'; // Blue - In progress
    return '#6b7280'; // Gray - Starting
};

/**
 * Get motivational message based on progress
 */
export const getMotivationalMessage = (goal: Goal): string => {
    const percentage = calculateGoalPercentage(goal);

    if (percentage >= 100) {
        return `🎉 Goal reached! You can ${goal.name.toLowerCase()} now!`;
    }

    if (percentage >= 75) {
        const remaining = getRemainingAmount(goal);
        return `Almost there! Just $${remaining.toFixed(0)} more!`;
    }

    if (percentage >= 50) {
        return `Halfway there! Keep it up! 💪`;
    }

    if (percentage >= 25) {
        return `Making progress! 🚀`;
    }

    return `You got this! Start saving! 💰`;
};

/**
 * Get funding source display name
 */
export const getFundingSourceName = (source: GoalFundingSource): string => {
    switch (source) {
        case 'main':
            return 'Main Balance';
        case 'savings':
            return 'Savings';
        case 'both':
            return 'Main & Savings';
        default:
            return 'Unknown';
    }
};

/**
 * Get funding source icon
 */
export const getFundingSourceIcon = (source: GoalFundingSource): string => {
    switch (source) {
        case 'main':
            return 'wallet';
        case 'savings':
            return 'piggy-bank';
        case 'both':
            return 'wallet-plus';
        default:
            return 'help-circle';
    }
};

/**
 * Validate goal input
 */
export const validateGoalInput = (
    name: string,
    targetAmount: number | null,
    fundingSource: GoalFundingSource
): { valid: boolean; error?: string } => {
    if (!name || name.trim().length === 0) {
        return { valid: false, error: 'Goal name is required' };
    }

    if (name.length > 50) {
        return { valid: false, error: 'Goal name is too long (max 50 characters)' };
    }

    if (targetAmount !== null && targetAmount <= 0) {
        return { valid: false, error: 'Target amount must be greater than 0' };
    }

    if (!['main', 'savings', 'both'].includes(fundingSource)) {
        return { valid: false, error: 'Invalid funding source' };
    }

    return { valid: true };
};

/**
 * Project when a goal will be reached based on its planned monthly contribution.
 * Returns nulls when there's no target amount or no monthly contribution set.
 */
export const projectGoalPayoff = (
    goal: Goal
): { monthsRemaining: number | null; etaDate: Date | null; reached: boolean } => {
    if (!goal.targetAmount) {
        return { monthsRemaining: null, etaDate: null, reached: false };
    }

    const remaining = getRemainingAmount(goal);
    if (remaining <= 0) {
        return { monthsRemaining: 0, etaDate: new Date(), reached: true };
    }

    if (!goal.monthlyContribution || goal.monthlyContribution <= 0) {
        return { monthsRemaining: null, etaDate: null, reached: false };
    }

    const monthsRemaining = Math.ceil(remaining / goal.monthlyContribution);
    const etaDate = new Date();
    etaDate.setMonth(etaDate.getMonth() + monthsRemaining);

    return { monthsRemaining, etaDate, reached: false };
};

/**
 * Sort goals by priority (nearest to completion first)
 */
export const sortGoalsByProgress = (goals: Goal[]): Goal[] => {
    return [...goals].sort((a, b) => {
        // Completed goals go last
        if (a.isCompleted && !b.isCompleted) return 1;
        if (!a.isCompleted && b.isCompleted) return -1;

        // Among active goals, sort by percentage (highest first)
        const percentA = calculateGoalPercentage(a);
        const percentB = calculateGoalPercentage(b);

        return percentB - percentA;
    });
};
