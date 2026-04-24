// ============================================================
// PINCHANTED — Global Header
// src/components/GlobalHeader.tsx
//
// Persistent header shown across all tab screens.
// Shows the Pinchanted wordmark on the left, notification
// bell with unread badge and profile avatar on the right.
// Avatar shows uploaded image if available, emoji fallback otherwise.
// ============================================================

import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
} from 'react-native';
import { router } from 'expo-router';
import { AntDesign } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../stores/auth.store';
import { supabase } from '../lib/supabase';
import { Colors } from '../constants/colors';
import { Theme } from '../constants/theme';

const AVATAR_EMOJI_MAP: Record<string, string> = {
  castle: '🏰', star: '⭐', crown: '👑', magic: '✨',
  mouse: '🐭', heart: '💖', rainbow: '🌈', rocket: '🚀',
  flower: '🌸',
};

export function GlobalHeader() {
  const { profile } = useAuthStore();
  const insets = useSafeAreaInsets();
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchUnreadCount = useCallback(async () => {
    if (!profile?.id) return;
    const { count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', profile.id)
      .eq('is_read', false);
    setUnreadCount(count ?? 0);
  }, [profile?.id]);

  useEffect(() => {
    fetchUnreadCount();
    // Poll for new notifications every 30 seconds
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  const avatarEmoji = AVATAR_EMOJI_MAP[profile?.avatar_style || ''] || '✨';
  const hasAvatarImage = !!profile?.avatar_url;

  return (
    <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
      {/* Pinchanted wordmark */}
      <TouchableOpacity
        onPress={() => router.push('/(tabs)/' as any)}
        activeOpacity={0.8}
      >
        <Text style={styles.wordmark}>Pinchanted</Text>
      </TouchableOpacity>

      {/* Right actions */}
      <View style={styles.actions}>
        {/* Notification bell */}
        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => router.push('/notifications' as any)}
          activeOpacity={0.7}
        >
          <AntDesign name="bell" size={20} color={Colors.textPrimary} />
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Profile avatar */}
        <TouchableOpacity
          style={styles.avatarButton}
          onPress={() => router.push('/profile/')}
          activeOpacity={0.7}
        >
          {hasAvatarImage ? (
            <Image
              source={{ uri: profile!.avatar_url! }}
              style={styles.avatarImage}
            />
          ) : (
            <View style={styles.avatarEmoji}>
              <Text style={styles.avatarEmojiText}>{avatarEmoji}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Theme.screenPadding,
    paddingBottom: 10,
    backgroundColor: 'rgba(11,21,84,0.98)',
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(245,197,24,0.15)',
  },

  wordmark: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.gold,
    letterSpacing: 0.3,
  },

  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },

  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 0.5,
    borderColor: 'rgba(245,197,24,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },

  badge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.crimson,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: 'rgba(11,21,84,1)',
  },
  badgeText: {
    fontSize: 9,
    color: '#fff',
    fontWeight: '700',
    lineHeight: 11,
  },

  avatarButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: Colors.goldBorder,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 18,
  },
  avatarEmoji: {
    width: '100%',
    height: '100%',
    backgroundColor: Colors.royalBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEmojiText: {
    fontSize: 18,
  },
});