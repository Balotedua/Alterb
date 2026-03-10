/**
 * Centralized Nebula action types and interfaces.
 * All Nebula-related type definitions live here to avoid scattering
 * across store, hooks, and component files.
 */

import type { NebulaIntent, NebulaResponseType } from '@/store/nebulaStore';

// ── Action Types ─────────────────────────────────────────────────────────────

/** Standardized action types for every Nebula response */
export enum NebulaActionType {
  /** Text-only reply, no fragment */
  REPLY         = 'reply',
  /** Display a fragment (VISUAL / ACTION / HYBRID) */
  SHOW_FRAGMENT = 'show_fragment',
  /** Requires explicit user confirmation before executing */
  CONFIRM       = 'confirm',
}

// ── Module ───────────────────────────────────────────────────────────────────

export type NebulaModule = 'FINANCE' | 'HEALTH' | 'PSYCH' | 'NONE';

// ── Confirmation ─────────────────────────────────────────────────────────────

/**
 * Pending action gated behind a user confirmation step.
 * Stored in nebulaStore.pendingConfirmation; resolved by NebulaConfirmCard.
 */
export interface NebulaConfirmation {
  /** Question displayed to the user */
  question: string;
  /** Confirm button label (default: "Conferma") */
  confirmLabel?: string;
  /** Cancel button label (default: "Annulla") */
  cancelLabel?: string;
  /** Fragment to open when the user confirms */
  fragment: string;
  /** Params to pass to the fragment */
  params: Record<string, unknown>;
  /** Response type for the fragment */
  responseType: NebulaResponseType;
  /** Intent to set on confirmation */
  intent: NebulaIntent;
  /** Intensity to set on confirmation */
  intensity: number;
}

// ── Context Memory ───────────────────────────────────────────────────────────

/**
 * Snapshot of the last meaningful intent — used for pronoun resolution
 * ("cancellala", "mostrami quella") in localIntentParser.
 */
export interface NebulaContext {
  intent: NebulaIntent;
  module: NebulaModule;
  fragment: string;
  params: Record<string, unknown>;
}
