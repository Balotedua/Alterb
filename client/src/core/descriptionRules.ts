// ─── Description → Subcategory rules (localStorage, per user) ──────────────
// Normalized key: lowercase + trim + collapse spaces

function normalize(desc: string): string {
  return desc.toLowerCase().trim().replace(/\s+/g, ' ');
}

function storageKey(userId: string): string {
  return `_alter_desc_rules_${userId}`;
}

export function getRules(userId: string): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(storageKey(userId)) ?? '{}'); } catch { return {}; }
}

export function setRule(userId: string, description: string, subcategory: string): void {
  const rules = getRules(userId);
  rules[normalize(description)] = subcategory;
  localStorage.setItem(storageKey(userId), JSON.stringify(rules));
}

export function removeRule(userId: string, description: string): void {
  const rules = getRules(userId);
  delete rules[normalize(description)];
  localStorage.setItem(storageKey(userId), JSON.stringify(rules));
}

export function applyRule(userId: string, description: string): string | null {
  const rules = getRules(userId);
  return rules[normalize(description)] ?? null;
}
