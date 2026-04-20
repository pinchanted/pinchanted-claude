// ============================================================
// PINCHANTED — Auth Session Manager
// src/lib/auth.ts
// Keeps session in memory for reliable access across screens
// ============================================================

import { Session } from '@supabase/supabase-js';

let currentSession: Session | null = null;

export const setCurrentSession = (session: Session | null) => {
  currentSession = session;
};

export const getCurrentSession = () => currentSession;

export const getCurrentUserId = () => currentSession?.user?.id || null;