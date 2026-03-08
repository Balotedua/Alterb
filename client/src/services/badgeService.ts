/**
 * BadgeService — Event-Driven Gamification
 *
 * Centralizes all gamification event dispatch.
 * All business logic lives server-side in the `process_gamification_event` RPC.
 *
 * Usage:
 *   await badgeService.triggerEvent(userId, 'transaction_added', { count: 5 });
 */

import { supabase } from '@/services/supabase';
import type { GamificationEventType, GamificationEventResult } from '@/types/gamification';

export interface TriggerEventPayload {
  /** For threshold-based badges: the current total count after the action. */
  count?: number;
  [key: string]: unknown;
}

export const badgeService = {
  /**
   * Fire a gamification event. The RPC handles XP, streak, and badge unlocking.
   *
   * @param userId  - Supabase auth UID (must match auth.uid() server-side)
   * @param type    - Event type string
   * @param payload - Optional payload; include `count` for threshold badges
   * @returns Result with awarded badge IDs and XP gained, or null on error
   */
  async triggerEvent(
    userId: string,
    type: GamificationEventType,
    payload: TriggerEventPayload = {},
  ): Promise<GamificationEventResult | null> {
    const { data, error } = await supabase.rpc('process_gamification_event', {
      p_user_id:    userId,
      p_event_type: type,
      p_payload:    payload,
    });

    if (error) {
      console.error('[BadgeService] triggerEvent error:', error.message);
      return null;
    }

    return data as GamificationEventResult;
  },

  /**
   * Directly award a badge by ID (admin / manual unlock).
   * Calls the `award_badge` RPC which is idempotent.
   */
  async awardBadge(userId: string, badgeId: string): Promise<boolean> {
    const { data, error } = await supabase.rpc('award_badge', {
      p_user_id:  userId,
      p_badge_id: badgeId,
    });

    if (error) {
      console.error('[BadgeService] awardBadge error:', error.message);
      return false;
    }

    return data as boolean;
  },
};
