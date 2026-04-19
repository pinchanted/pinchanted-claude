// ============================================================
// PINCHANTED — Theme Constants
// src/constants/theme.ts
// ============================================================

export const Theme = {
  // ── Spacing ─────────────────────────────────────────────────
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    xxxl: 32,
  },

  // ── Border radius ───────────────────────────────────────────
  radius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 28,
    pill: 100,
    circle: 9999,
  },

  // ── Font sizes ──────────────────────────────────────────────
  fontSize: {
    xs: 9,
    sm: 11,
    md: 13,
    lg: 15,
    xl: 18,
    xxl: 22,
    xxxl: 28,
  },

  // ── Font weights ────────────────────────────────────────────
  fontWeight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },

  // ── Screen padding ──────────────────────────────────────────
  screenPadding: 16,

  // ── Bottom tab bar height ───────────────────────────────────
  tabBarHeight: 60,

  // ── Header height ───────────────────────────────────────────
  headerHeight: 100,

  // ── Pin grid ────────────────────────────────────────────────
  pinGrid: {
    columns: 3,
    gap: 8,
    cardRadius: 12,
  },

  // ── Animations ──────────────────────────────────────────────
  animation: {
    fast: 150,
    normal: 250,
    slow: 400,
  },
};