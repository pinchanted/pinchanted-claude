// ============================================================
// PINCHANTED — Home Screen
// app/(tabs)/index.tsx
// ============================================================

import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { AntDesign } from '@expo/vector-icons';
import { useAuthStore } from '../../src/stores/auth.store';
import { supabase } from '../../src/lib/supabase';
import { Colors } from '../../src/constants/colors';
import { Theme } from '../../src/constants/theme';

interface HomeStats {
  totalPins: number;
  totalValue: number;
  activeTrades: number;
  wishlistCount: number;
}

export default function HomeScreen() {
  const { profile, signOut } = useAuthStore();
  const [stats, setStats] = useState<HomeStats>({
    totalPins: 0,
    totalValue: 0,
    activeTrades: 0,
    wishlistCount: 0,
  });

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    if (!profile?.id) return;

    const { data: pins } = await supabase
      .from('collection_pins')
      .select('my_purchase_price')
      .eq('user_id', profile.id);

    const { count: tradeCount } = await supabase
      .from('trades')
      .select('*', { count: 'exact', head: true })
      .or(`initiator_id.eq.${profile.id},recipient_id.eq.${profile.id}`)
      .not('status', 'in', '("completed","declined","expired")');

    const { count: wishlistCount } = await supabase
      .from('collection_pins')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', profile.id)
      .eq('is_wishlisted', true);

    const totalPins = pins?.length || 0;
    const totalValue = pins?.reduce((sum, pin) =>
      sum + (pin.my_purchase_price || 0), 0) || 0;

    setStats({
      totalPins,
      totalValue,
      activeTrades: tradeCount || 0,
      wishlistCount: wishlistCount || 0,
    });
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const getFirstName = () => {
    return profile?.display_name?.split(' ')[0] || 'Collector';
  };

  const getAvatarEmoji = () => {
    const avatarMap: Record<string, string> = {
      castle: '🏰', star: '⭐', crown: '👑', magic: '✨',
      mouse: '🐭', heart: '💖', rainbow: '🌈', rocket: '🚀',
      flower: '🌸',
    };
    return avatarMap[profile?.avatar_style || ''] || '✨';
  };

  return (
    <LinearGradient
      colors={['#0f1d6e', '#0b1554', '#08103d']}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={styles.greeting}>{getGreeting()},</Text>
              <Text style={styles.name}>{getFirstName()}! ✨</Text>
            </View>
            <TouchableOpacity
              style={styles.avatarButton}
              onPress={() => router.push('/profile/index')}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarEmoji}>{getAvatarEmoji()}</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Stats row */}
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stats.totalPins}</Text>
              <Text style={styles.statLabel}>Pins</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCard}>
              <Text style={styles.statValue}>
                ${stats.totalValue.toFixed(0)}
              </Text>
              <Text style={styles.statLabel}>Value</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stats.activeTrades}</Text>
              <Text style={styles.statLabel}>Trades</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stats.wishlistCount}</Text>
              <Text style={styles.statLabel}>Wishlist</Text>
            </View>
          </View>

          {/* Quick actions */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Quick actions</Text>
            <View style={styles.quickActions}>
              <TouchableOpacity
                style={styles.quickAction}
                onPress={() => router.push('/pin/add')}
              >
                <View style={[styles.quickActionIcon,
                  { backgroundColor: 'rgba(192,24,42,0.15)' }]}>
                  <AntDesign name="plus" size={20} color={Colors.crimson} />
                </View>
                <Text style={styles.quickActionLabel}>Add pin</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickAction}
                onPress={() => router.push('/(tabs)/marketplace')}
              >
                <View style={[styles.quickActionIcon,
                  { backgroundColor: 'rgba(245,197,24,0.12)' }]}>
                  <AntDesign name="search" size={20} color={Colors.gold} />
                </View>
                <Text style={styles.quickActionLabel}>Browse</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickAction}
                onPress={() => router.push('/(tabs)/trades')}
              >
                <View style={[styles.quickActionIcon,
                  { backgroundColor: 'rgba(93,202,122,0.12)' }]}>
                  <AntDesign name="swap" size={20} color={Colors.success} />
                </View>
                <Text style={styles.quickActionLabel}>Trades</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickAction}
                onPress={() => router.push('/(tabs)/wishlist')}
              >
                <View style={[styles.quickActionIcon,
                  { backgroundColor: 'rgba(249,200,216,0.12)' }]}>
                  <AntDesign name="heart" size={20} color={Colors.pink} />
                </View>
                <Text style={styles.quickActionLabel}>Wishlist</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Collection summary */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>My collection</Text>
              <TouchableOpacity
                onPress={() => router.push('/(tabs)/collection')}
              >
                <Text style={styles.sectionLink}>See all →</Text>
              </TouchableOpacity>
            </View>

            {stats.totalPins === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyEmoji}>📌</Text>
                <Text style={styles.emptyTitle}>
                  Your collection is empty
                </Text>
                <Text style={styles.emptySubtitle}>
                  Add your first pin to get started!
                </Text>
                <TouchableOpacity
                  style={styles.emptyButton}
                  onPress={() => router.push('/pin/add')}
                >
                  <Text style={styles.emptyButtonText}>Add a pin</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.collectionSummary}>
                <View style={styles.collectionSummaryRow}>
                  <Text style={styles.collectionSummaryLabel}>
                    Total pins
                  </Text>
                  <Text style={styles.collectionSummaryValue}>
                    {stats.totalPins}
                  </Text>
                </View>
                <View style={styles.collectionSummaryRow}>
                  <Text style={styles.collectionSummaryLabel}>
                    Est. value
                  </Text>
                  <Text style={styles.collectionSummaryValue}>
                    ${stats.totalValue.toFixed(2)}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.viewCollectionButton}
                  onPress={() => router.push('/(tabs)/collection')}
                >
                  <Text style={styles.viewCollectionText}>
                    View collection
                  </Text>
                  <AntDesign name="right" size={12} color={Colors.gold} />
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Active trades */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Active trades</Text>
              <TouchableOpacity
                onPress={() => router.push('/(tabs)/trades')}
              >
                <Text style={styles.sectionLink}>See all →</Text>
              </TouchableOpacity>
            </View>

            {stats.activeTrades === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyEmoji}>🔄</Text>
                <Text style={styles.emptyTitle}>No active trades</Text>
                <Text style={styles.emptySubtitle}>
                  Browse the Marketplace to find pins to trade!
                </Text>
                <TouchableOpacity
                  style={styles.emptyButton}
                  onPress={() => router.push('/(tabs)/marketplace')}
                >
                  <Text style={styles.emptyButtonText}>
                    Browse Marketplace
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.tradesCard}
                onPress={() => router.push('/(tabs)/trades')}
              >
                <View style={styles.tradesBadge}>
                  <Text style={styles.tradesBadgeText}>
                    {stats.activeTrades}
                  </Text>
                </View>
                <Text style={styles.tradesCardText}>
                  {stats.activeTrades === 1
                    ? '1 trade needs your attention'
                    : `${stats.activeTrades} trades need your attention`}
                </Text>
                <AntDesign name="right" size={14} color={Colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          {/* Sign out — temporary for testing */}
          <TouchableOpacity
            style={styles.signOutButton}
            onPress={signOut}
          >
            <Text style={styles.signOutText}>Sign out</Text>
          </TouchableOpacity>

        </ScrollView>

        {/* FAB */}
        <TouchableOpacity
          style={styles.fab}
          onPress={() => router.push('/pin/add')}
        >
          <AntDesign name="plus" size={24} color="#fff" />
        </TouchableOpacity>

      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Theme.screenPadding,
    paddingTop: Theme.spacing.xl,
    paddingBottom: 100,
    gap: Theme.spacing.xl,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerLeft: {
    gap: 2,
  },
  greeting: {
    fontSize: Theme.fontSize.md,
    color: Colors.textMuted,
  },
  name: {
    fontSize: Theme.fontSize.xxl,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  avatarButton: {
    padding: 2,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.royalBlue,
    borderWidth: 2,
    borderColor: Colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEmoji: {
    fontSize: 22,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 0.5,
    borderColor: Colors.goldBorder,
    borderRadius: Theme.radius.lg,
    overflow: 'hidden',
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    padding: Theme.spacing.md,
    gap: 4,
  },
  statValue: {
    fontSize: Theme.fontSize.xl,
    fontWeight: '500',
    color: Colors.textPrimary,
    lineHeight: 24,
  },
  statLabel: {
    fontSize: Theme.fontSize.xs,
    color: Colors.textMuted,
  },
  statDivider: {
    width: 0.5,
    backgroundColor: Colors.goldBorder,
    marginVertical: Theme.spacing.sm,
  },

  // Section
  section: {
    gap: Theme.spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: Theme.fontSize.md,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  sectionLink: {
    fontSize: Theme.fontSize.sm,
    color: Colors.gold,
  },

  // Quick actions
  quickActions: {
    flexDirection: 'row',
    gap: Theme.spacing.sm,
  },
  quickAction: {
    flex: 1,
    alignItems: 'center',
    gap: Theme.spacing.xs,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 0.5,
    borderColor: 'rgba(245,197,24,0.15)',
    borderRadius: Theme.radius.md,
    padding: Theme.spacing.md,
  },
  quickActionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionLabel: {
    fontSize: Theme.fontSize.xs,
    color: Colors.textMuted,
  },

  // Empty state
  emptyCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 0.5,
    borderColor: 'rgba(245,197,24,0.12)',
    borderRadius: Theme.radius.lg,
    padding: Theme.spacing.xl,
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  emptyEmoji: {
    fontSize: 36,
    marginBottom: Theme.spacing.xs,
  },
  emptyTitle: {
    fontSize: Theme.fontSize.md,
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
  emptyButton: {
    backgroundColor: Colors.crimson,
    borderRadius: Theme.radius.pill,
    paddingVertical: Theme.spacing.sm,
    paddingHorizontal: Theme.spacing.lg,
    marginTop: Theme.spacing.xs,
    borderWidth: 1,
    borderColor: Colors.goldBorder,
  },
  emptyButtonText: {
    color: Colors.textPrimary,
    fontSize: Theme.fontSize.sm,
    fontWeight: '500',
  },

  // Collection summary
  collectionSummary: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 0.5,
    borderColor: Colors.goldBorder,
    borderRadius: Theme.radius.lg,
    padding: Theme.spacing.lg,
    gap: Theme.spacing.sm,
  },
  collectionSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  collectionSummaryLabel: {
    fontSize: Theme.fontSize.sm,
    color: Colors.textMuted,
  },
  collectionSummaryValue: {
    fontSize: Theme.fontSize.sm,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  viewCollectionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Theme.spacing.xs,
    paddingTop: Theme.spacing.sm,
    borderTopWidth: 0.5,
    borderTopColor: Colors.goldBorder,
    marginTop: Theme.spacing.xs,
  },
  viewCollectionText: {
    fontSize: Theme.fontSize.sm,
    color: Colors.gold,
  },

  // Trades card
  tradesCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.md,
    backgroundColor: 'rgba(192,24,42,0.08)',
    borderWidth: 0.5,
    borderColor: 'rgba(192,24,42,0.3)',
    borderRadius: Theme.radius.lg,
    padding: Theme.spacing.lg,
  },
  tradesBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.crimson,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  tradesBadgeText: {
    fontSize: Theme.fontSize.sm,
    fontWeight: '500',
    color: '#fff',
  },
  tradesCardText: {
    flex: 1,
    fontSize: Theme.fontSize.sm,
    color: Colors.textPrimary,
  },

  // Sign out
  signOutButton: {
    alignItems: 'center',
    padding: Theme.spacing.md,
  },
  signOutText: {
    fontSize: Theme.fontSize.sm,
    color: Colors.textMuted,
  },

  // FAB
  fab: {
    position: 'absolute',
    bottom: 80,
    right: Theme.screenPadding,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.crimson,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.goldBorder,
    elevation: 8,
  },
});