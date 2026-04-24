// ============================================================
// PINCHANTED — Admin Trade Oversight
// app/admin/trades.tsx
// ============================================================

import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { AntDesign } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../src/lib/supabase';
import { Colors } from '../../src/constants/colors';
import { Theme } from '../../src/constants/theme';
import { Trade, TradeDispute, Profile } from '../../src/types/database.types';

type FilterType = 'disputes' | 'active' | 'all';

interface TradeWithDispute extends Trade {
  dispute?: TradeDispute;
}

export default function AdminTradesScreen() {
  const insets = useSafeAreaInsets();
  const [trades, setTrades] = useState<TradeWithDispute[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterType>('disputes');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchTrades();
  }, [filter]);

  const fetchTrades = async () => {
    setIsLoading(true);

    let query = supabase
      .from('trades')
      .select(`
        *,
        initiator:profiles!initiator_id(id, username, display_name, trade_rating),
        recipient:profiles!recipient_id(id, username, display_name, trade_rating)
      `)
      .order('updated_at', { ascending: false })
      .limit(50);

    if (filter === 'disputes') {
      query = query.eq('status', 'disputed');
    } else if (filter === 'active') {
      query = query.in('status', ['pending', 'in_progress', 'confirmed', 'arrange_shipping', 'shipping', 'delivered']);
    }

    const { data: tradesData } = await query;

    if (!tradesData) {
      setIsLoading(false);
      return;
    }

    // Fetch disputes for disputed trades
    const disputedIds = tradesData
      .filter(t => t.status === 'disputed')
      .map(t => t.id);

    let disputesMap: Record<string, TradeDispute> = {};
    if (disputedIds.length > 0) {
      const { data: disputesData } = await supabase
        .from('trade_disputes')
        .select('*')
        .in('trade_id', disputedIds)
        .eq('status', 'open');

      if (disputesData) {
        disputesData.forEach(d => { disputesMap[d.trade_id] = d; });
      }
    }

    setTrades(tradesData.map(t => ({ ...t, dispute: disputesMap[t.id] })) as TradeWithDispute[]);
    setIsLoading(false);
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchTrades();
    setRefreshing(false);
  }, [filter]);

  const handleResolveDispute = (trade: TradeWithDispute) => {
    if (!trade.dispute) return;
    Alert.alert(
      'Resolve dispute',
      'Mark this dispute as resolved?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Resolve',
          onPress: async () => {
            setActionLoading(trade.id);
            await supabase
              .from('trade_disputes')
              .update({ status: 'resolved', resolved_at: new Date().toISOString() })
              .eq('id', trade.dispute!.id);
            await supabase
              .from('trades')
              .update({ status: 'completed' })
              .eq('id', trade.id);
            await fetchTrades();
            setActionLoading(null);
          },
        },
      ]
    );
  };

  const handleCancelTrade = (trade: TradeWithDispute) => {
    Alert.alert(
      'Cancel trade?',
      'Cancel this trade and release all pins? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Cancel trade',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(trade.id);
            // Release pins
            const allPinIds = [
              ...(trade.offered_pin_ids || []),
              ...(trade.requested_pin_ids || []),
            ];
            if (allPinIds.length > 0) {
              await supabase
                .from('collection_pins')
                .update({ trade_status: 'available', trade_id: null })
                .in('id', allPinIds);
            }
            await supabase
              .from('trades')
              .update({ status: 'declined' })
              .eq('id', trade.id);
            if (trade.dispute) {
              await supabase
                .from('trade_disputes')
                .update({ status: 'closed', resolved_at: new Date().toISOString() })
                .eq('id', trade.dispute.id);
            }
            await fetchTrades();
            setActionLoading(null);
          },
        },
      ]
    );
  };

  const getStatusConfig = (status: string) => {
    const configs: Record<string, { color: string; bg: string }> = {
      pending: { color: Colors.gold, bg: 'rgba(245,197,24,0.1)' },
      in_progress: { color: '#93c5fd', bg: 'rgba(100,160,255,0.1)' },
      confirmed: { color: Colors.success, bg: 'rgba(93,202,122,0.1)' },
      arrange_shipping: { color: Colors.success, bg: 'rgba(93,202,122,0.1)' },
      shipping: { color: '#93c5fd', bg: 'rgba(100,160,255,0.1)' },
      delivered: { color: Colors.gold, bg: 'rgba(245,197,24,0.1)' },
      completed: { color: Colors.success, bg: 'rgba(93,202,122,0.1)' },
      disputed: { color: Colors.error, bg: 'rgba(192,24,42,0.1)' },
      declined: { color: Colors.textMuted, bg: 'rgba(255,255,255,0.05)' },
    };
    return configs[status] || configs.pending;
  };

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / 86400000);
    const diffHours = Math.floor(diffMs / 3600000);
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    return `${diffDays}d ago`;
  };

  const renderTrade = ({ item }: { item: TradeWithDispute }) => {
    const statusConfig = getStatusConfig(item.status);
    const isActionLoading = actionLoading === item.id;
    const initiator = item.initiator as any;
    const recipient = item.recipient as any;

    return (
      <View style={[
        styles.tradeCard,
        item.status === 'disputed' && styles.tradeCardDisputed,
      ]}>
        {/* Status + time */}
        <View style={styles.tradeHeader}>
          <View style={[styles.statusPill, {
            backgroundColor: statusConfig.bg,
            borderColor: statusConfig.color,
          }]}>
            <Text style={[styles.statusPillText, { color: statusConfig.color }]}>
              {item.status.replace('_', ' ')}
            </Text>
          </View>
          <Text style={styles.tradeTime}>{getTimeAgo(item.updated_at)}</Text>
        </View>

        {/* Users */}
        <View style={styles.tradeUsers}>
          <View style={styles.tradeUser}>
            <Text style={styles.tradeUserLabel}>Initiator</Text>
            <Text style={styles.tradeUserName}>@{initiator?.username || 'unknown'}</Text>
          </View>
          <AntDesign name="swap" size={14} color={Colors.textMuted} />
          <View style={styles.tradeUser}>
            <Text style={styles.tradeUserLabel}>Recipient</Text>
            <Text style={styles.tradeUserName}>@{recipient?.username || 'unknown'}</Text>
          </View>
        </View>

        {/* Pin counts */}
        <View style={styles.tradePinCounts}>
          <Text style={styles.tradePinCountText}>
            {item.offered_pin_ids?.length || 0} pin{(item.offered_pin_ids?.length || 0) !== 1 ? 's' : ''} offered
            {' '}↔{' '}
            {item.requested_pin_ids?.length || 0} pin{(item.requested_pin_ids?.length || 0) !== 1 ? 's' : ''} requested
          </Text>
        </View>

        {/* Dispute info */}
        {item.dispute && (
          <View style={styles.disputeBox}>
            <Text style={styles.disputeLabel}>⚠️ Dispute reason:</Text>
            <Text style={styles.disputeReason}>{item.dispute.reason}</Text>
          </View>
        )}

        {/* Actions */}
        {isActionLoading ? (
          <ActivityIndicator size="small" color={Colors.gold} style={{ marginTop: Theme.spacing.sm }} />
        ) : (
          <View style={styles.tradeActions}>
            <TouchableOpacity
              style={styles.viewBtn}
              onPress={() => router.push(`/trade/${item.id}`)}
            >
              <AntDesign name="eye" size={12} color={Colors.textMuted} />
              <Text style={styles.viewBtnText}>View trade</Text>
            </TouchableOpacity>

            {item.status === 'disputed' && item.dispute && (
              <TouchableOpacity
                style={styles.resolveBtn}
                onPress={() => handleResolveDispute(item)}
              >
                <AntDesign name="check" size={12} color={Colors.success} />
                <Text style={styles.resolveBtnText}>Resolve</Text>
              </TouchableOpacity>
            )}

            {['disputed', 'pending', 'in_progress'].includes(item.status) && (
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => handleCancelTrade(item)}
              >
                <AntDesign name="close" size={12} color={Colors.error} />
                <Text style={styles.cancelBtnText}>Cancel trade</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <LinearGradient colors={['#0f1d6e', '#0b1554', '#08103d']} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>

        <View style={[styles.headerBar, { paddingTop: Theme.spacing.md + insets.top }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <AntDesign name="left" size={18} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Trade Oversight</Text>
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>{trades.length}</Text>
          </View>
        </View>

        {/* Filter */}
        <View style={styles.controls}>
          <View style={styles.filterRow}>
            {(['disputes', 'active', 'all'] as FilterType[]).map(f => (
              <TouchableOpacity
                key={f}
                style={[styles.filterChip, filter === f && styles.filterChipActive]}
                onPress={() => setFilter(f)}
              >
                <Text style={[styles.filterChipText, filter === f && styles.filterChipTextActive]}>
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.gold} />
          </View>
        ) : (
          <FlatList
            data={trades}
            keyExtractor={item => item.id}
            renderItem={renderTrade}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.gold} />
            }
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyEmoji}>
                  {filter === 'disputes' ? '✅' : '🔄'}
                </Text>
                <Text style={styles.emptyText}>
                  {filter === 'disputes' ? 'No open disputes' : 'No trades found'}
                </Text>
              </View>
            }
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
  headerTitle: {
    fontSize: Theme.fontSize.lg,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  headerBadge: {
    backgroundColor: Colors.goldFaint,
    borderWidth: 0.5, borderColor: Colors.goldBorder,
    borderRadius: Theme.radius.pill,
    paddingVertical: 3, paddingHorizontal: 10,
  },
  headerBadgeText: { fontSize: Theme.fontSize.sm, color: Colors.gold },

  controls: {
    backgroundColor: 'rgba(15,29,110,0.95)',
    padding: Theme.screenPadding,
    paddingTop: Theme.spacing.sm,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(245,197,24,0.08)',
  },
  filterRow: { flexDirection: 'row', gap: Theme.spacing.xs },
  filterChip: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: Theme.radius.pill,
    paddingVertical: 5, paddingHorizontal: 12,
  },
  filterChipActive: { backgroundColor: Colors.goldFaint, borderColor: Colors.goldBorder },
  filterChipText: { fontSize: Theme.fontSize.xs, color: Colors.textMuted },
  filterChipTextActive: { color: Colors.gold, fontWeight: '500' },

  listContent: {
    padding: Theme.screenPadding,
    paddingBottom: 60,
    gap: Theme.spacing.md,
  },

  tradeCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 0.5,
    borderColor: 'rgba(245,197,24,0.15)',
    borderRadius: Theme.radius.md,
    padding: Theme.spacing.md,
    gap: Theme.spacing.sm,
  },
  tradeCardDisputed: {
    borderColor: 'rgba(192,24,42,0.4)',
    backgroundColor: 'rgba(192,24,42,0.05)',
  },
  tradeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusPill: {
    borderWidth: 0.5,
    borderRadius: Theme.radius.pill,
    paddingVertical: 3, paddingHorizontal: 9,
  },
  statusPillText: { fontSize: 10, fontWeight: '500' },
  tradeTime: { fontSize: Theme.fontSize.xs, color: Colors.textMuted },

  tradeUsers: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.md,
  },
  tradeUser: { flex: 1, gap: 2 },
  tradeUserLabel: { fontSize: Theme.fontSize.xs, color: Colors.textMuted },
  tradeUserName: { fontSize: Theme.fontSize.sm, fontWeight: '500', color: Colors.textPrimary },

  tradePinCounts: {},
  tradePinCountText: { fontSize: Theme.fontSize.xs, color: Colors.textMuted },

  disputeBox: {
    backgroundColor: 'rgba(192,24,42,0.1)',
    borderWidth: 0.5,
    borderColor: 'rgba(192,24,42,0.3)',
    borderRadius: Theme.radius.sm,
    padding: Theme.spacing.sm,
    gap: 4,
  },
  disputeLabel: { fontSize: Theme.fontSize.xs, fontWeight: '500', color: Colors.error },
  disputeReason: { fontSize: Theme.fontSize.xs, color: Colors.textSecondary, lineHeight: 16 },

  tradeActions: {
    flexDirection: 'row',
    gap: Theme.spacing.sm,
    flexWrap: 'wrap',
  },
  viewBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: Theme.radius.pill,
    paddingVertical: 5, paddingHorizontal: 10,
  },
  viewBtnText: { fontSize: 10, color: Colors.textMuted },
  resolveBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.successFaint,
    borderWidth: 0.5, borderColor: Colors.successBorder,
    borderRadius: Theme.radius.pill,
    paddingVertical: 5, paddingHorizontal: 10,
  },
  resolveBtnText: { fontSize: 10, color: Colors.success, fontWeight: '500' },
  cancelBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.errorFaint,
    borderWidth: 0.5, borderColor: Colors.errorBorder,
    borderRadius: Theme.radius.pill,
    paddingVertical: 5, paddingHorizontal: 10,
  },
  cancelBtnText: { fontSize: 10, color: Colors.error, fontWeight: '500' },

  emptyState: { alignItems: 'center', padding: Theme.spacing.xl, gap: Theme.spacing.md },
  emptyEmoji: { fontSize: 48 },
  emptyText: { fontSize: Theme.fontSize.sm, color: Colors.textMuted },
});