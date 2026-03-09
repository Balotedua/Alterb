import type { ComponentType } from 'react';
import { FinanceOverviewFragment, FinanceChartFragment, FinanceListFragment, FinanceAddFragment, FinanceDeleteFragment } from './finance';
import { HealthOverviewFragment, HealthSleepFragment, HealthWaterFragment }   from './health';
import { PsychOverviewFragment, MoodHistoryFragment }                         from './psychology';

type FragmentComponent = ComponentType<{ params: Record<string, unknown> }>;

export const FRAGMENT_REGISTRY: Record<string, FragmentComponent> = {
  // Finance
  FinanceOverview: FinanceOverviewFragment,
  FinanceChart:    FinanceChartFragment,
  FinanceList:     FinanceListFragment,
  FinanceAdd:      FinanceAddFragment,
  FinanceDelete:   FinanceDeleteFragment,

  // Health
  HealthOverview: HealthOverviewFragment,
  HealthSleep:    HealthSleepFragment,
  HealthWater:    HealthWaterFragment,

  // Psychology
  PsychOverview:  PsychOverviewFragment,
  MoodHistory:    MoodHistoryFragment,
};

export type FragmentName = keyof typeof FRAGMENT_REGISTRY;
