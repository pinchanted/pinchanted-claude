// ============================================================
// PINCHANTED — Colour Palette
// src/constants/colors.ts
// ============================================================

export const Colors = {
  // ── Brand colours ──────────────────────────────────────────
  royalBlue: '#0f1d6e',
  deepBlue: '#1a2a8f',
  backgroundDark: '#08103d',
  backgroundMid: '#0b1554',

  // ── Accent colours ─────────────────────────────────────────
  gold: '#f5c518',
  goldDark: '#d4a017',
  goldFaint: 'rgba(245,197,24,0.1)',
  goldBorder: 'rgba(245,197,24,0.25)',

  // ── Action colours ─────────────────────────────────────────
  crimson: '#c0182a',
  crimsonLight: '#e02040',
  crimsonFaint: 'rgba(192,24,42,0.15)',

  // ── Status colours ─────────────────────────────────────────
  success: '#5dca7a',
  successFaint: 'rgba(93,202,122,0.15)',
  successBorder: 'rgba(93,202,122,0.35)',

  warning: '#f5c518',
  warningFaint: 'rgba(245,197,24,0.12)',

  error: '#ff8a95',
  errorFaint: 'rgba(192,24,42,0.15)',
  errorBorder: 'rgba(192,24,42,0.35)',

  // ── Trade status colours ────────────────────────────────────
  onTable: '#f5c518',         // gold — pin is in a trade offer
  onTableFaint: 'rgba(245,197,24,0.08)',
  onTableBorder: 'rgba(245,197,24,0.5)',

  wanted: '#93c5fd',          // blue — someone wants this pin
  wantedFaint: 'rgba(100,160,255,0.08)',
  wantedBorder: 'rgba(100,160,255,0.4)',

  committed: '#ff8a95',       // red — pin is leaving collection
  committedFaint: 'rgba(192,24,42,0.08)',
  committedBorder: 'rgba(192,24,42,0.35)',

  // ── Wishlist pink ───────────────────────────────────────────
  pink: '#f9c8d8',
  pinkFaint: 'rgba(249,200,216,0.15)',
  pinkBorder: 'rgba(249,200,216,0.35)',

  // ── Edition badge colours ───────────────────────────────────
  limitedEdition: '#ff8a95',
  openEdition: '#5dca7a',
  limitedRelease: '#c4b5fd',

  // ── Text colours ───────────────────────────────────────────
  textPrimary: '#ffffff',
  textSecondary: 'rgba(255,255,255,0.65)',
  textMuted: 'rgba(255,255,255,0.38)',
  textFaint: 'rgba(255,255,255,0.22)',
  textPlaceholder: 'rgba(255,255,255,0.30)',

  // ── Surface colours ─────────────────────────────────────────
  surface: 'rgba(255,255,255,0.06)',
  surfaceBorder: 'rgba(245,197,24,0.15)',
  surfaceHover: 'rgba(255,255,255,0.09)',

  // ── Overlay colours ─────────────────────────────────────────
  overlay: 'rgba(8,16,61,0.96)',
  overlayLight: 'rgba(8,16,61,0.5)',

  // ── Gradients (as arrays for LinearGradient) ────────────────
  gradients: {
    header: ['#0f1d6e', '#1a0a2e'] as string[],
    hero: ['#1a0a2e', '#2d1060', '#c0182a'] as string[],
    background: ['#0b1554', '#08103d'] as string[],
    pinPurple: ['#1a2a8f', '#2d1060'] as string[],
    pinCrimson: ['#2d1060', '#c0182a'] as string[],
    pinGreen: ['#0f3d2a', '#1a6040'] as string[],
    pinAmber: ['#3d1a00', '#7c3a00'] as string[],
    pinIndigo: ['#1a1060', '#4a1a8f'] as string[],
    pinPink: ['#3d0a2a', '#8f1a5a'] as string[],
  },

  // ── Transparent ─────────────────────────────────────────────
  transparent: 'transparent',
};

// Edition types for pin badges
export const EditionColors = {
  'Limited Edition': {
    background: 'rgba(192,24,42,0.25)',
    border: 'rgba(192,24,42,0.5)',
    text: '#ff8a95',
    short: 'LE',
  },
  'Open Edition': {
    background: 'rgba(26,92,42,0.2)',
    border: 'rgba(93,202,122,0.35)',
    text: '#5dca7a',
    short: 'OE',
  },
  'Limited Release': {
    background: 'rgba(124,58,237,0.2)',
    border: 'rgba(124,58,237,0.4)',
    text: '#c4b5fd',
    short: 'LR',
  },
};

// Trade status colours for collection grid
export const TradeStatusColors = {
  available: {
    border: 'rgba(245,197,24,0.15)',
    background: 'rgba(255,255,255,0.06)',
  },
  on_table: {
    border: 'rgba(245,197,24,0.5)',
    background: 'rgba(245,197,24,0.06)',
  },
  requested: {
    border: 'rgba(100,160,255,0.4)',
    background: 'rgba(100,160,255,0.05)',
  },
  committed: {
    border: 'rgba(192,24,42,0.35)',
    background: 'rgba(255,255,255,0.03)',
  },
};