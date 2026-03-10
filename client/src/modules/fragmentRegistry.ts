import type { ComponentType } from 'react';
import { FinanceOverviewFragment } from './finance/FinanceOverviewFragment';
import { FinanceChartFragment }    from './finance/FinanceChartFragment';
import { FinanceListFragment }     from './finance/FinanceListFragment';
import { FinanceAddFragment }      from './finance/FinanceAddFragment';
import { FinanceDeleteFragment }   from './finance/FinanceDeleteFragment';
import { FinanceCsvFragment }      from './finance/FinanceCsvFragment';
import { FinanceCategoryFragment }  from './finance/FinanceCategoryFragment';
import { FinanceAnalyticsFragment } from './finance/FinanceAnalyticsFragment';
import { HealthOverviewFragment }  from './health/HealthOverviewFragment';
import { HealthSleepFragment }     from './health/HealthSleepFragment';
import { HealthWaterFragment }     from './health/HealthWaterFragment';
import { HealthSetupFragment }     from './health/HealthSetupFragment';
import { HealthDailyFragment }     from './health/HealthDailyFragment';
import { HealthGoalsFragment }     from './health/HealthGoalsFragment';
import { MoodHistoryFragment }     from './psychology/MoodHistoryFragment';
import { PsychOverviewFragment }   from './psychology/PsychOverviewFragment';
import { SettingsFragment }        from './settings/SettingsFragment';
import { HelpFragment }            from './help/HelpFragment';

type FragmentComponent = ComponentType<{ params: Record<string, unknown> }>;

export const FRAGMENT_REGISTRY: Record<string, FragmentComponent> = {
  // Finance — keys match localIntentParser fragment names
  FinanceOverview: FinanceOverviewFragment,
  FinanceChart:    FinanceChartFragment,
  FinanceList:     FinanceListFragment,
  FinanceAdd:      FinanceAddFragment,
  FinanceDelete:   FinanceDeleteFragment,
  FinanceCsv:      FinanceCsvFragment,
  FinanceCategory:  FinanceCategoryFragment,
  FinanceAnalytics: FinanceAnalyticsFragment,

  // Health
  HealthOverview: HealthOverviewFragment,
  HealthSleep:    HealthSleepFragment,
  HealthWater:    HealthWaterFragment,
  HealthSetup:    HealthSetupFragment,
  HealthDaily:    HealthDailyFragment,
  HealthGoals:    HealthGoalsFragment,

  // Psychology
  PsychOverview:  PsychOverviewFragment,
  MoodHistory:    MoodHistoryFragment,

  // Settings
  Settings:       SettingsFragment,

  // Help
  Help:           HelpFragment,
};

export type FragmentName = keyof typeof FRAGMENT_REGISTRY;
