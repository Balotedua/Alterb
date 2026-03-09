import { FinanceAddFragment } from './finance/FinanceAddFragment';
import { FinanceChartFragment } from './finance/FinanceChartFragment';
import { FinanceListFragment } from './finance/FinanceListFragment';
import { FinanceOverviewFragment } from './finance/FinanceOverviewFragment';
import { FinanceDeleteFragment } from './finance/FinanceDeleteFragment';
import { HealthOverviewFragment } from './health/HealthOverviewFragment';
import { HealthSleepFragment } from './health/HealthSleepFragment';
import { HealthWaterFragment } from './health/HealthWaterFragment';
import { MoodHistoryFragment } from './psychology/MoodHistoryFragment';
import { PsychOverviewFragment } from './psychology/PsychOverviewFragment';
import { SettingsFragment } from './settings/SettingsFragment';

export const FRAGMENT_REGISTRY: Record<string, React.ComponentType<any>> = {
  FinanceAddFragment,
  FinanceChartFragment,
  FinanceListFragment,
  FinanceOverviewFragment,
  FinanceDeleteFragment,
  HealthOverviewFragment,
  HealthSleepFragment,
  HealthWaterFragment,
  MoodHistoryFragment,
  PsychOverviewFragment,
  SettingsFragment,
};
