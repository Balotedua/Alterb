/**
 * iconMapper — Maps DB icon strings → Lucide React components
 *
 * Usage:
 *   const Icon = getIconComponent('Flame');
 *   <Icon size={24} />
 *
 *   or shorthand:
 *   renderIcon('Flame', { size: 24, color: '#f97316' })
 */

import type { LucideProps } from 'lucide-react';
import {
  Activity,
  Award,
  BookOpen,
  Brain,
  Compass,
  Crown,
  Dumbbell,
  FileText,
  Flame,
  Heart,
  Medal,
  PiggyBank,
  Shield,
  Smile,
  Star,
  Target,
  TrendingUp,
  Trophy,
  Wallet,
  Zap,
} from 'lucide-react';
import type { ComponentType } from 'react';

// ─── Icon registry ────────────────────────────────────────────────────────────

const ICON_REGISTRY: Record<string, ComponentType<LucideProps>> = {
  Activity,
  Award,
  BookOpen,
  Brain,
  Compass,
  Crown,
  Dumbbell,
  FileText,
  Flame,
  Heart,
  Medal,
  PiggyBank,
  Shield,
  Smile,
  Star,
  Target,
  TrendingUp,
  Trophy,
  Wallet,
  Zap,
};

/** Returns the Lucide component for a given icon name, falling back to Trophy. */
export function getIconComponent(name: string): ComponentType<LucideProps> {
  return ICON_REGISTRY[name] ?? Trophy;
}

/** Renders a Lucide icon by name with optional props. */
export function renderIcon(name: string, props?: LucideProps) {
  const Icon = getIconComponent(name);
  return <Icon {...props} />;
}
