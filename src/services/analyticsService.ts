// Analytics & Cash Flow Intelligence Service — Multi-Horizon Telemetry & Cash Flow Engine
import {
  startOfMonth,
  endOfMonth,
  startOfQuarter,
  endOfQuarter,
  startOfYear,
  endOfYear,
  subMonths,
  subQuarters,
  subYears,
  format,
  eachDayOfInterval,
  isSameDay,
  addDays,
} from 'date-fns';
import { TransactionRepository } from '../database/repositories/TransactionRepository';
import { CategoryRepository } from '../database/repositories/CategoryRepository';
import { AccountRepository } from '../database/repositories/AccountRepository';
import type { Transaction, Category } from '../types/models';

export type TimeHorizon = 'month' | 'quarter' | 'year' | 'ytd';

export interface HistogramBucket {
  label: string;
  inflow: number;
  outflow: number;
  net: number;
}

export interface CumulativePoint {
  date: string;
  label: string;
  value: number;
  inflow: number;
  outflow: number;
}

export interface CategorySpendItem {
  categoryId: string;
  categoryName: string;
  categoryIcon: string;
  categoryColor: string;
  amount: number;
  percentage: number;
  transactionCount: number;
}

export interface AnalyticsData {
  horizon: TimeHorizon;
  horizonTitle: string;
  currency: string;
  inflow: number;
  outflow: number;
  netSavings: number;
  savingsRate: number; // percentage (e.g. 34.5)
  priorSavingsRate: number;
  savingsRateDelta: number; // e.g. +4.2%
  priorNetSavings: number;
  histogramBuckets: HistogramBucket[];
  cumulativePoints: CumulativePoint[];
  categoryBreakdown: CategorySpendItem[];
}

export class AnalyticsService {
  private txRepo = new TransactionRepository();
  private catRepo = new CategoryRepository();
  private accRepo = new AccountRepository();

  async loadAnalytics(
    accountId: string,
    userId: string,
    horizon: TimeHorizon = 'month',
    dateAnchor: Date = new Date()
  ): Promise<AnalyticsData> {
    const [acc, allCategories, txs] = await Promise.all([
      this.accRepo.findById(accountId),
      this.catRepo.findByUser(userId),
      this.txRepo.findByAccount(accountId),
    ]);

    const currency = acc?.currency || 'USD';

    // 1. Determine date boundaries for Current and Prior periods
    const { currentStart, currentEnd, priorStart, priorEnd, horizonTitle } = this.getDateBoundaries(
      horizon,
      dateAnchor
    );

    // 2. Filter transactions for current period (excluding pure inter-wallet transfers from revenue/expense)
    const currentTxs = txs.filter(
      (t) => t.date >= currentStart.getTime() && t.date <= currentEnd.getTime()
    );
    const priorTxs = txs.filter(
      (t) => t.date >= priorStart.getTime() && t.date <= priorEnd.getTime()
    );

    // 3. Current period metrics
    let inflow = 0;
    let outflow = 0;
    const catSpendMap = new Map<string, { amount: number; count: number }>();

    for (const t of currentTxs) {
      const amt = t.convertedAmount ?? t.amount;
      const isTransfer = t.type === 'transfer' || !!t.destinationWalletId;

      if (!isTransfer) {
        if (t.type === 'income') {
          inflow += amt;
        } else if (t.type === 'expense') {
          outflow += amt;
          if (t.categoryId) {
            const cur = catSpendMap.get(t.categoryId) || { amount: 0, count: 0 };
            cur.amount += amt;
            cur.count += 1;
            catSpendMap.set(t.categoryId, cur);
          }
        }
      }
    }

    const netSavings = inflow - outflow;
    const savingsRate = inflow > 0 ? (netSavings / inflow) * 100 : 0;

    // 4. Prior period metrics
    let priorInflow = 0;
    let priorOutflow = 0;
    for (const t of priorTxs) {
      const amt = t.convertedAmount ?? t.amount;
      const isTransfer = t.type === 'transfer' || !!t.destinationWalletId;
      if (!isTransfer) {
        if (t.type === 'income') priorInflow += amt;
        else if (t.type === 'expense') priorOutflow += amt;
      }
    }

    const priorNetSavings = priorInflow - priorOutflow;
    const priorSavingsRate = priorInflow > 0 ? (priorNetSavings / priorInflow) * 100 : 0;
    const savingsRateDelta = savingsRate - priorSavingsRate;

    // 5. Dual-Bar Histogram Buckets
    const histogramBuckets = this.buildHistogramBuckets(horizon, currentStart, currentEnd, currentTxs);

    // 6. Cumulative Net Cash Flow Points
    const cumulativePoints = this.buildCumulativeTrend(currentStart, currentEnd, currentTxs);

    // 7. Category Breakdown with Percentages
    const categoryMap = new Map<string, Category>();
    allCategories.forEach((c) => categoryMap.set(c.id, c));

    const categoryBreakdown: CategorySpendItem[] = [];
    catSpendMap.forEach((val, catId) => {
      const cat = categoryMap.get(catId);
      const percentage = outflow > 0 ? (val.amount / outflow) * 100 : 0;
      categoryBreakdown.push({
        categoryId: catId,
        categoryName: cat?.name || 'Other',
        categoryIcon: cat?.icon || 'tag-outline',
        categoryColor: cat?.color || '#94A3B8',
        amount: Math.round(val.amount * 100) / 100,
        percentage: Math.round(percentage * 10) / 10,
        transactionCount: val.count,
      });
    });

    categoryBreakdown.sort((a, b) => b.amount - a.amount);

    return {
      horizon,
      horizonTitle,
      currency,
      inflow,
      outflow,
      netSavings,
      savingsRate: Math.round(savingsRate * 10) / 10,
      priorSavingsRate: Math.round(priorSavingsRate * 10) / 10,
      savingsRateDelta: Math.round(savingsRateDelta * 10) / 10,
      priorNetSavings,
      histogramBuckets,
      cumulativePoints,
      categoryBreakdown,
    };
  }

  private getDateBoundaries(horizon: TimeHorizon, anchor: Date) {
    let currentStart: Date;
    let currentEnd: Date;
    let priorStart: Date;
    let priorEnd: Date;
    let horizonTitle: string;

    switch (horizon) {
      case 'quarter': {
        currentStart = startOfQuarter(anchor);
        currentEnd = endOfQuarter(anchor);
        const priorAnchor = subQuarters(anchor, 1);
        priorStart = startOfQuarter(priorAnchor);
        priorEnd = endOfQuarter(priorAnchor);
        const qNum = Math.floor(anchor.getMonth() / 3) + 1;
        horizonTitle = `Q${qNum} ${format(anchor, 'yyyy')}`;
        break;
      }
      case 'year': {
        currentStart = startOfYear(anchor);
        currentEnd = endOfYear(anchor);
        const priorAnchor = subYears(anchor, 1);
        priorStart = startOfYear(priorAnchor);
        priorEnd = endOfYear(priorAnchor);
        horizonTitle = format(anchor, 'yyyy');
        break;
      }
      case 'ytd': {
        currentStart = startOfYear(anchor);
        currentEnd = anchor;
        const priorAnchor = subYears(anchor, 1);
        priorStart = startOfYear(priorAnchor);
        priorEnd = priorAnchor;
        horizonTitle = `YTD ${format(anchor, 'yyyy')}`;
        break;
      }
      case 'month':
      default: {
        currentStart = startOfMonth(anchor);
        currentEnd = endOfMonth(anchor);
        const priorAnchor = subMonths(anchor, 1);
        priorStart = startOfMonth(priorAnchor);
        priorEnd = endOfMonth(priorAnchor);
        horizonTitle = format(anchor, 'MMMM yyyy').toUpperCase();
        break;
      }
    }

    return { currentStart, currentEnd, priorStart, priorEnd, horizonTitle };
  }

  private buildHistogramBuckets(
    horizon: TimeHorizon,
    start: Date,
    end: Date,
    txs: Transaction[]
  ): HistogramBucket[] {
    const buckets: HistogramBucket[] = [];

    if (horizon === 'month') {
      // 4-5 weekly buckets
      let cur = new Date(start);
      let weekIndex = 1;
      while (cur <= end) {
        const next = addDays(cur, 6);
        const bucketEnd = next > end ? end : next;
        const bStart = cur.getTime();
        const bEnd = bucketEnd.getTime() + 86399999;

        let bIn = 0;
        let bOut = 0;
        for (const t of txs) {
          if (t.date >= bStart && t.date <= bEnd && t.type !== 'transfer' && !t.destinationWalletId) {
            const amt = t.convertedAmount ?? t.amount;
            if (t.type === 'income') bIn += amt;
            else if (t.type === 'expense') bOut += amt;
          }
        }

        buckets.push({
          label: `W${weekIndex}`,
          inflow: Math.round(bIn),
          outflow: Math.round(bOut),
          net: Math.round(bIn - bOut),
        });

        cur = addDays(bucketEnd, 1);
        weekIndex++;
      }
    } else if (horizon === 'quarter') {
      // 3 Monthly buckets
      for (let m = 0; m < 3; m++) {
        const mDate = new Date(start.getFullYear(), start.getMonth() + m, 1);
        const mStart = startOfMonth(mDate).getTime();
        const mEnd = endOfMonth(mDate).getTime();

        let bIn = 0;
        let bOut = 0;
        for (const t of txs) {
          if (t.date >= mStart && t.date <= mEnd && t.type !== 'transfer' && !t.destinationWalletId) {
            const amt = t.convertedAmount ?? t.amount;
            if (t.type === 'income') bIn += amt;
            else if (t.type === 'expense') bOut += amt;
          }
        }

        buckets.push({
          label: format(mDate, 'MMM').toUpperCase(),
          inflow: Math.round(bIn),
          outflow: Math.round(bOut),
          net: Math.round(bIn - bOut),
        });
      }
    } else {
      // 12 Monthly buckets
      for (let m = 0; m < 12; m++) {
        const mDate = new Date(start.getFullYear(), m, 1);
        if (mDate > end) break;
        const mStart = startOfMonth(mDate).getTime();
        const mEnd = endOfMonth(mDate).getTime();

        let bIn = 0;
        let bOut = 0;
        for (const t of txs) {
          if (t.date >= mStart && t.date <= mEnd && t.type !== 'transfer' && !t.destinationWalletId) {
            const amt = t.convertedAmount ?? t.amount;
            if (t.type === 'income') bIn += amt;
            else if (t.type === 'expense') bOut += amt;
          }
        }

        buckets.push({
          label: format(mDate, 'MMM').toUpperCase(),
          inflow: Math.round(bIn),
          outflow: Math.round(bOut),
          net: Math.round(bIn - bOut),
        });
      }
    }

    return buckets;
  }

  private buildCumulativeTrend(start: Date, end: Date, txs: Transaction[]): CumulativePoint[] {
    const days = eachDayOfInterval({ start, end });
    const points: CumulativePoint[] = [];
    let cumulative = 0;

    for (const day of days) {
      const dStart = day.getTime();
      const dEnd = dStart + 86399999;
      let dayIn = 0;
      let dayOut = 0;

      for (const t of txs) {
        if (t.date >= dStart && t.date <= dEnd && t.type !== 'transfer' && !t.destinationWalletId) {
          const amt = t.convertedAmount ?? t.amount;
          if (t.type === 'income') dayIn += amt;
          else if (t.type === 'expense') dayOut += amt;
        }
      }

      cumulative += dayIn - dayOut;
      points.push({
        date: format(day, 'yyyy-MM-dd'),
        label: format(day, 'd MMM'),
        value: Math.round(cumulative * 100) / 100,
        inflow: dayIn,
        outflow: dayOut,
      });
    }

    return points;
  }
}
