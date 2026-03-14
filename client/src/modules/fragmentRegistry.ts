import type { ComponentType } from 'react';
import { FinanceOverviewFragment } from './finance/FinanceOverviewFragment';
import { FinanceChartFragment }    from './finance/FinanceChartFragment';
import { FinanceListFragment }     from './finance/FinanceListFragment';
import { FinanceAddFragment }      from './finance/FinanceAddFragment';
import { FinanceDeleteFragment }      from './finance/FinanceDeleteFragment';
import { FinanceDeleteTabFragment }   from './finance/FinanceDeleteTabFragment';
import { FinanceCsvFragment }      from './finance/FinanceCsvFragment';
import { FinanceCategoryFragment }  from './finance/FinanceCategoryFragment';
import { FinanceLinkFragment }      from './finance/FinanceLinkFragment';
import { FinanceAnalyticsFragment } from './finance/FinanceAnalyticsFragment';
import { FinancePanoramaFragment }  from './finance/FinancePanoramaFragment';
import { HealthOverviewFragment }  from './health/HealthOverviewFragment';
import { HealthSleepFragment }     from './health/HealthSleepFragment';
import { HealthWaterFragment }     from './health/HealthWaterFragment';
import { HealthSetupFragment }     from './health/HealthSetupFragment';
import { HealthDailyFragment }     from './health/HealthDailyFragment';
import { HealthGoalsFragment }     from './health/HealthGoalsFragment';
import { HealthTrainingFragment }  from './health/HealthTrainingFragment';
import { HealthPRFragment }        from './health/HealthPRFragment';
import { HealthWorkoutFragment }   from './health/HealthWorkoutFragment';
import { MoodHistoryFragment }     from './psychology/MoodHistoryFragment';
import { PsychOverviewFragment }   from './psychology/PsychOverviewFragment';
import { SettingsFragment }        from './settings/SettingsFragment';
import { HelpFragment }            from './help/HelpFragment';
import { FinanceManualFragment }   from './help/FinanceManualFragment';
import { BugReportFragment }       from './bug/BugReportFragment';
import { AdminFragment }           from './admin/AdminFragment';
import { RoutineFragment }         from './routine/RoutineFragment';

type FragmentComponent = ComponentType<{ params: Record<string, unknown> }>;

export const FRAGMENT_REGISTRY: Record<string, FragmentComponent> = {
  // Finance — keys match localIntentParser fragment names
  FinanceOverview: FinanceOverviewFragment,
  FinanceChart:    FinanceChartFragment,
  FinanceList:     FinanceListFragment,
  FinanceAdd:      FinanceAddFragment,
  FinanceDelete:      FinanceDeleteFragment,
  FinanceDeleteTab:   FinanceDeleteTabFragment,
  FinanceCsv:      FinanceCsvFragment,
  FinanceCategory:  FinanceCategoryFragment,
  FinanceLink:      FinanceLinkFragment,
  FinanceAnalytics:  FinanceAnalyticsFragment,
  FinancePanorama:   FinancePanoramaFragment,

  // Health
  HealthOverview:  HealthOverviewFragment,
  HealthSleep:     HealthSleepFragment,
  HealthWater:     HealthWaterFragment,
  HealthSetup:     HealthSetupFragment,
  HealthDaily:     HealthDailyFragment,
  HealthGoals:     HealthGoalsFragment,
  HealthTraining:  HealthTrainingFragment,
  HealthPR:        HealthPRFragment,
  HealthWorkout:   HealthWorkoutFragment,

  // Psychology
  PsychOverview:  PsychOverviewFragment,
  MoodHistory:    MoodHistoryFragment,

  // Settings
  Settings:       SettingsFragment,

  // Help
  Help:           HelpFragment,
  FinanceManual:  FinanceManualFragment,

  // Bug report
  BugReport:      BugReportFragment,

  // Admin
  Admin:          AdminFragment,

  // Routine & Appuntamenti
  Routine:        RoutineFragment,
};

export type FragmentName = keyof typeof FRAGMENT_REGISTRY;
