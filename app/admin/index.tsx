// ============================================================
// PINCHANTED — Admin Panel
// app/admin/index.tsx
// ============================================================

import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { AntDesign } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../src/stores/auth.store';
import { supabase } from '../../src/lib/supabase';
import { Colors } from '../../src/constants/colors';
import { Theme } from '../../src/constants/theme';

interface AdminStats {
  totalUsers: number;
  totalPins: number;
  totalTrades: number;
  pendingCommunityPins: number;
  openDisputes: number;
  activeSuspensions: number;
}

export default function AdminScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useAuthStore();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!profile?.is_admin) {
      router.replace('/(tabs)');
      return;
    }
    fetchStats();
  }, []);

  const fetchStats = async () => {
    const [
      { count: totalUsers },
      { count: totalPins },
      { count: totalTrades },
      { count: pendingCommunityPins },
      { count: openDisputes },
      { count: activeSuspensions },
    ] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('collection_pins').select('*', { count: 'exact', head: true }),
      supabase.from('trades').select('*', { count: 'exact', head: true }),
      supabase.from('community_pins').select('*', { count: 'exact', head: true }).eq('status', 'unverified'),
      supabase.from('trade_disputes').select('*', { count: 'exact', head: true }).eq('status', 'open'),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('is_suspended', true),
    ]);

    setStats({
      totalUsers: totalUsers || 0,
      totalPins: totalPins || 0,
      totalTrades: totalTrades || 0,
      pendingCommunityPins: pendingCommunityPins || 0,
      openDisputes: openDisputes || 0,
      activeSuspensions: activeSuspensions || 0,
    });
    setIsLoading(false);
  };

  const NAV_ITEMS = [
    {
      icon: '👥',
      label: 'User Management',
      subtitle: 'View, suspend, and manage users',
      badge: stats?.activeSuspensions || 0,
      badgeColor: Colors.error,
      route: '/admin/users',
    },
    {
      icon: '📌',
      label: 'Pin Database',
      subtitle: 'Review and approve community pins',
      badge: stats?.pendingCommunityPins || 0,
      badgeColor: Colors.gold,
      route: '/admin/pins',
    },
    {
      icon: '🔄',
      label: 'Trade Oversight',
      subtitle: 'Monitor trades and resolve disputes',
      badge: stats?.openDisputes || 0,
      badgeColor: Colors.error,
      route: '/admin/trades',
    },
  ];

  return (
    <LinearGradient colors={['#0f1d6e', '#0b1554', '#08103d']} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>

        {/* Header */}
        <View style={[styles.headerBar, { paddingTop: Theme.spacing.md + insets.top }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <AntDesign name="left" size={18} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Admin Panel</Text>
          <View style={styles.adminBadge}>
            <Text style={styles.adminBadgeText}>Admin</Text>
          </View>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >

          {/* Stats */}
          {isLoading ? (
            <ActivityIndicator size="large" color={Colors.gold} style={{ marginTop: Theme.spacing.xl }} />
          ) : (
            <>
              <View style={styles.statsGrid}>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{stats?.totalUsers || 0}</Text>
                  <Text style={styles.statLabel}>Users</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{stats?.totalPins || 0}</Text>
                  <Text style={styles.statLabel}>Pins</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{stats?.totalTrades || 0}</Text>
                  <Text style={styles.statLabel}>Trades</Text>
                </View>
              </View>

              {/* Alerts */}
              {((stats?.pendingCommunityPins || 0) > 0 || (stats?.openDisputes || 0) > 0) && (
                <View style={styles.alertsCard}>
                  <Text style={styles.alertsTitle}>⚠️ Needs attention</Text>
                  {(stats?.pendingCommunityPins || 0) > 0 && (
                    <TouchableOpacity
                      style={styles.alertRow}
                      onPress={() => router.push('/admin/pins')}
                    >
                      <View style={[styles.alertDot, { backgroundColor: Colors.gold }]} />
                      <Text style={styles.alertText}>
                        {stats?.pendingCommunityPins} community pin{stats?.pendingCommunityPins !== 1 ? 's' : ''} awaiting review
                      </Text>
                      <AntDesign name="right" size={12} color={Colors.textMuted} />
                    </TouchableOpacity>
                  )}
                  {(stats?.openDisputes || 0) > 0 && (
                    <TouchableOpacity
                      style={styles.alertRow}
                      onPress={() => router.push('/admin/trades')}
                    >
                      <View style={[styles.alertDot, { backgroundColor: Colors.error }]} />
                      <Text style={styles.alertText}>
                        {stats?.openDisputes} open trade dispute{stats?.openDisputes !== 1 ? 's' : ''}
                      </Text>
                      <AntDesign name="right" size={12} color={Colors.textMuted} />
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {/* Navigation */}
              <View style={styles.navSection}>
                <Text style={styles.sectionTitle}>Management</Text>
                {NAV_ITEMS.map((item, i) => (
                  <TouchableOpacity
                    key={i}
                    style={styles.navCard}
                    onPress={() => router.push(item.route as any)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.navIcon}>{item.icon}</Text>
                    <View style={styles.navInfo}>
                      <Text style={styles.navLabel}>{item.label}</Text>
                      <Text style={styles.navSubtitle}>{item.subtitle}</Text>
                    </View>
                    <View style={styles.navRight}>
                      {item.badge > 0 && (
                        <View style={[styles.navBadge, { backgroundColor: item.badgeColor }]}>
                          <Text style={styles.navBadgeText}>{item.badge}</Text>
                        </View>
                      )}
                      <AntDesign name="right" size={14} color={Colors.textMuted} />
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },

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
  headerTitle: {
    fontSize: Theme.fontSize.lg,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  adminBadge: {
    backgroundColor: 'rgba(192,24,42,0.15)',
    borderWidth: 0.5,
    borderColor: 'rgba(192,24,42,0.4)',
    borderRadius: Theme.radius.pill,
    paddingVertical: 3,
    paddingHorizontal: 10,
  },
  adminBadgeText: {
    fontSize: Theme.fontSize.xs,
    color: Colors.error,
    fontWeight: '500',
  },

  scrollView: { flex: 1 },
  scrollContent: {
    padding: Theme.screenPadding,
    paddingBottom: 60,
    gap: Theme.spacing.xl,
  },

  // Stats
  statsGrid: {
    flexDirection: 'row',
    gap: Theme.spacing.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 0.5,
    borderColor: Colors.goldBorder,
    borderRadius: Theme.radius.lg,
    padding: Theme.spacing.md,
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: Theme.fontSize.xxl,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  statLabel: {
    fontSize: Theme.fontSize.xs,
    color: Colors.textMuted,
  },

  // Alerts
  alertsCard: {
    backgroundColor: 'rgba(192,24,42,0.08)',
    borderWidth: 0.5,
    borderColor: 'rgba(192,24,42,0.3)',
    borderRadius: Theme.radius.md,
    padding: Theme.spacing.md,
    gap: Theme.spacing.sm,
  },
  alertsTitle: {
    fontSize: Theme.fontSize.sm,
    fontWeight: '500',
    color: Colors.textPrimary,
    marginBottom: Theme.spacing.xs,
  },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  alertDot: {
    width: 8, height: 8, borderRadius: 4,
    flexShrink: 0,
  },
  alertText: {
    flex: 1,
    fontSize: Theme.fontSize.sm,
    color: Colors.textSecondary,
  },

  // Nav
  navSection: { gap: Theme.spacing.md },
  sectionTitle: {
    fontSize: Theme.fontSize.sm,
    fontWeight: '500',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  navCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.md,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 0.5,
    borderColor: 'rgba(245,197,24,0.15)',
    borderRadius: Theme.radius.md,
    padding: Theme.spacing.md,
  },
  navIcon: { fontSize: 24, flexShrink: 0 },
  navInfo: { flex: 1, gap: 2 },
  navLabel: {
    fontSize: Theme.fontSize.md,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  navSubtitle: {
    fontSize: Theme.fontSize.xs,
    color: Colors.textMuted,
  },
  navRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
    flexShrink: 0,
  },
  navBadge: {
    minWidth: 22, height: 22, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 6,
  },
  navBadgeText: {
    fontSize: Theme.fontSize.xs,
    color: '#fff',
    fontWeight: '500',
  },
});