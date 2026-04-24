// ============================================================
// PINCHANTED — Notifications Inbox
// app/notifications.tsx
// ============================================================

import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { AntDesign } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../src/stores/auth.store';
import { supabase } from '../src/lib/supabase';
import { Colors } from '../src/constants/colors';
import { Theme } from '../src/constants/theme';

interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, any> | null;
  is_read: boolean;
  sent_at: string;
}

// Icon and color for each notification type
const getNotifStyle = (type: string): { emoji: string; color: string; bg: string } => {
  if (type.startsWith('trade_offer')) {
    return { emoji: '🎯', color: Colors.gold, bg: 'rgba(245,197,24,0.1)' };
  }
  if (type === 'trade_offer_accepted') {
    return { emoji: '🎉', color: Colors.success, bg: 'rgba(93,202,122,0.1)' };
  }
  if (type === 'trade_offer_declined') {
    return { emoji: '❌', color: Colors.error, bg: 'rgba(192,24,42,0.1)' };
  }
  if (type === 'trade_package_shipped') {
    return { emoji: '📦', color: '#93c5fd', bg: 'rgba(100,160,255,0.1)' };
  }
  if (type === 'trade_package_received') {
    return { emoji: '✅', color: Colors.success, bg: 'rgba(93,202,122,0.1)' };
  }
  if (type === 'trade_completed') {
    return { emoji: '✨', color: Colors.gold, bg: 'rgba(245,197,24,0.1)' };
  }
  if (type === 'trade_disputed') {
    return { emoji: '⚠️', color: Colors.error, bg: 'rgba(192,24,42,0.1)' };
  }
  if (type === 'community_pin_verified') {
    return { emoji: '📌', color: Colors.success, bg: 'rgba(93,202,122,0.1)' };
  }
  if (type.startsWith('wishlist')) {
    return { emoji: '💫', color: Colors.pink, bg: 'rgba(249,200,216,0.1)' };
  }
  if (type.startsWith('listing')) {
    return { emoji: '🏪', color: Colors.gold, bg: 'rgba(245,197,24,0.1)' };
  }
  if (type.startsWith('subscription') || type.startsWith('trial')) {
    return { emoji: '⭐', color: Colors.gold, bg: 'rgba(245,197,24,0.1)' };
  }
  if (type.startsWith('admin')) {
    return { emoji: '🚨', color: Colors.error, bg: 'rgba(192,24,42,0.1)' };
  }
  return { emoji: '🔔', color: Colors.textMuted, bg: 'rgba(255,255,255,0.05)' };
};

const getTimeAgo = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
};

export default function NotificationsScreen() {
  const { profile } = useAuthStore();
  const insets = useSafeAreaInsets();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (profile?.id) {
      fetchNotifications();
    }
  }, [profile?.id]);

  const fetchNotifications = async () => {
    if (!profile?.id) return;
    setIsLoading(true);

    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', profile.id)
      .order('sent_at', { ascending: false })
      .limit(50);

    if (data) {
      setNotifications(data as Notification[]);
      setUnreadCount(data.filter(n => !n.is_read).length);
    }

    setIsLoading(false);
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchNotifications();
    setRefreshing(false);
  }, [profile?.id]);

  const markAsRead = async (notifId: string) => {
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notifId);

    setNotifications(prev =>
      prev.map(n => n.id === notifId ? { ...n, is_read: true } : n)
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const markAllAsRead = async () => {
    if (!profile?.id || unreadCount === 0) return;

    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', profile.id)
      .eq('is_read', false);

    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);
  };

  const handleNotificationPress = async (notif: Notification) => {
    // Mark as read
    if (!notif.is_read) {
      await markAsRead(notif.id);
    }

    // Navigate to relevant screen based on type
    if (notif.data?.trade_id && notif.type.startsWith('trade')) {
      router.push(`/trade/${notif.data.trade_id}`);
    } else if (notif.data?.pin_id && notif.type === 'community_pin_verified') {
      // Navigate to collection
      router.push('/(tabs)/collection');
    }
  };

  const renderNotification = ({ item }: { item: Notification }) => {
    const style = getNotifStyle(item.type);

    return (
      <TouchableOpacity
        style={[
          styles.notifCard,
          !item.is_read && styles.notifCardUnread,
        ]}
        onPress={() => handleNotificationPress(item)}
        activeOpacity={0.7}
      >
        {/* Unread indicator */}
        {!item.is_read && <View style={styles.unreadDot} />}

        {/* Icon */}
        <View style={[styles.notifIcon, { backgroundColor: style.bg }]}>
          <Text style={styles.notifEmoji}>{style.emoji}</Text>
        </View>

        {/* Content */}
        <View style={styles.notifContent}>
          <View style={styles.notifHeader}>
            <Text style={[
              styles.notifTitle,
              !item.is_read && styles.notifTitleUnread,
            ]} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={styles.notifTime}>{getTimeAgo(item.sent_at)}</Text>
          </View>
          <Text style={styles.notifBody} numberOfLines={2}>
            {item.body}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <LinearGradient
      colors={['#0f1d6e', '#0b1554', '#08103d']}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea}>

        {/* Header */}
        <View style={[styles.headerBar, { paddingTop: Theme.spacing.md + insets.top }]}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <AntDesign name="left" size={18} color={Colors.textPrimary} />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Notifications</Text>
            {unreadCount > 0 && (
              <View style={styles.headerBadge}>
                <Text style={styles.headerBadgeText}>{unreadCount} unread</Text>
              </View>
            )}
          </View>

          {unreadCount > 0 ? (
            <TouchableOpacity
              style={styles.markAllButton}
              onPress={markAllAsRead}
            >
              <Text style={styles.markAllText}>Mark all read</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ width: 80 }} />
          )}
        </View>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.gold} />
          </View>
        ) : (
          <FlatList
            data={notifications}
            keyExtractor={item => item.id}
            renderItem={renderNotification}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={Colors.gold}
              />
            }
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyEmoji}>🔔</Text>
                <Text style={styles.emptyTitle}>No notifications yet</Text>
                <Text style={styles.emptySubtitle}>
                  When you receive trade offers, shipping updates, or other activity, they'll appear here.
                </Text>
              </View>
            }
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Theme.screenPadding,
    paddingBottom: Theme.spacing.md,
    backgroundColor: 'rgba(15,29,110,0.95)',
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(245,197,24,0.12)',
  },
  backButton: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  headerTitle: {
    fontSize: Theme.fontSize.lg,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  headerBadge: {
    backgroundColor: Colors.crimson,
    borderRadius: Theme.radius.pill,
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  headerBadgeText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '500',
  },
  markAllButton: {
    width: 80,
    alignItems: 'flex-end',
  },
  markAllText: {
    fontSize: Theme.fontSize.xs,
    color: Colors.gold,
  },

  listContent: {
    paddingVertical: Theme.spacing.md,
    paddingBottom: 40,
  },

  notifCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Theme.spacing.md,
    paddingHorizontal: Theme.screenPadding,
    paddingVertical: Theme.spacing.md,
    position: 'relative',
  },
  notifCardUnread: {
    backgroundColor: 'rgba(245,197,24,0.04)',
  },
  unreadDot: {
    position: 'absolute',
    left: 6,
    top: '50%',
    marginTop: -3,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.gold,
  },
  notifIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  notifEmoji: { fontSize: 20 },
  notifContent: { flex: 1, gap: 3 },
  notifHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Theme.spacing.sm,
  },
  notifTitle: {
    flex: 1,
    fontSize: Theme.fontSize.sm,
    color: Colors.textSecondary,
    fontWeight: '400',
  },
  notifTitleUnread: {
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  notifTime: {
    fontSize: 10,
    color: Colors.textFaint,
    flexShrink: 0,
  },
  notifBody: {
    fontSize: Theme.fontSize.xs,
    color: Colors.textMuted,
    lineHeight: 17,
  },

  separator: {
    height: 0.5,
    backgroundColor: 'rgba(245,197,24,0.06)',
    marginHorizontal: Theme.screenPadding,
  },

  emptyState: {
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: Theme.screenPadding * 2,
    gap: Theme.spacing.md,
  },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: {
    fontSize: Theme.fontSize.xl,
    fontWeight: '500',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: Theme.fontSize.sm,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
});