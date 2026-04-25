// ============================================================
// PINCHANTED — Trades Screen
// app/(tabs)/trades.tsx
// ============================================================

import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { AntDesign } from '@expo/vector-icons';
import { useAuthStore } from '../../src/stores/auth.store';
import { supabase, getPinImageUrl } from '../../src/lib/supabase';
import { Colors } from '../../src/constants/colors';
import { Theme } from '../../src/constants/theme';
import { Trade, TradeStatus } from '../../src/types/database.types';

type TabType = 'active' | 'completed';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  pending: { label: 'Pending', color: Colors.gold, bg: 'rgba(245,197,24,0.1)', border: 'rgba(245,197,24,0.35)' },
  in_progress: { label: 'In Progress', color: '#93c5fd', bg: 'rgba(100,160,255,0.1)', border: 'rgba(100,160,255,0.35)' },
  confirmed: { label: 'Confirmed', color: Colors.success, bg: 'rgba(93,202,122,0.1)', border: 'rgba(93,202,122,0.35)' },
  arrange_shipping: { label: 'Arrange Shipping', color: Colors.success, bg: 'rgba(93,202,122,0.1)', border: 'rgba(93,202,122,0.35)' },
  shipping: { label: 'Shipping', color: Colors.error, bg: 'rgba(192,24,42,0.1)', border: 'rgba(192,24,42,0.35)' },
  delivered: { label: 'Delivered', color: Colors.error, bg: 'rgba(192,24,42,0.1)', border: 'rgba(192,24,42,0.35)' },
  completed: { label: 'Completed', color: Colors.success, bg: 'rgba(93,202,122,0.1)', border: 'rgba(93,202,122,0.35)' },
  declined: { label: 'Declined', color: Colors.textMuted, bg: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.12)' },
  expired: { label: 'Expired', color: Colors.textMuted, bg: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.12)' },
  disputed: { label: 'Disputed', color: Colors.error, bg: 'rgba(192,24,42,0.1)', border: 'rgba(192,24,42,0.35)' },
};

const ACTIVE_STATUSES = ['pending', 'in_progress', 'confirmed', 'arrange_shipping', 'shipping', 'delivered'];
const COMPLETED_STATUSES = ['completed', 'declined', 'expired', 'disputed'];

export default function TradesScreen() {
  const { profile } = useAuthStore();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [pinImageUrls, setPinImageUrls] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('active');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!profile?.id) { setIsLoading(false); return; }
    fetchTrades();
  }, [profile?.id, activeTab]);

  const fetchTrades = async () => {
    if (!profile?.id) { setIsLoading(false); return; }
    setIsLoading(true);
    const statuses = activeTab === 'active' ? ACTIVE_STATUSES : COMPLETED_STATUSES;

    const { data, error } = await supabase
      .from('trades')
      .select(`
        *,
        initiator:profiles!initiator_id(id, username, display_name, avatar_url, trade_rating),
        recipient:profiles!recipient_id(id, username, display_name, avatar_url, trade_rating)
      `)
      .or(`initiator_id.eq.${profile.id},recipient_id.eq.${profile.id}`)
      .in('status', statuses)
      .order('updated_at', { ascending: false });

    if (!error && data) {
      setTrades(data as Trade[]);
      const allPinIds = (data as Trade[]).flatMap(t => [
        ...(t.offered_pin_ids || []),
        ...(t.requested_pin_ids || []),
      ]);
      if (allPinIds.length) {
        const { data: pins } = await supabase
          .from('collection_pins')
          .select('id, my_image_path')
          .in('id', allPinIds);
        if (pins) {
          const urls: Record<string, string> = {};
          pins.forEach((pin: any) => {
            if (pin.my_image_path) {
              const url = getPinImageUrl(pin.my_image_path);
              if (url) urls[pin.id] = url;
            }
          });
          setPinImageUrls(urls);
        }
      }
    }
    setIsLoading(false);
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchTrades();
    setRefreshing(false);
  }, [profile?.id, activeTab]);

  const getOtherUser = (trade: Trade) => {
    const isInitiator = trade.initiator_id === profile?.id;
    return isInitiator ? trade.recipient : trade.initiator;
  };

  const getTradeDirection = (trade: Trade) =>
    trade.initiator_id === profile?.id ? 'Sent' : 'Received';

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    return `${diffDays}d ago`;
  };

  const getExpiryText = (trade: Trade) => {
    if (!['pending', 'in_progress'].includes(trade.status)) return null;
    const expiry = new Date(trade.expires_at);
    const now = new Date();
    const diffHours = Math.floor((expiry.getTime() - now.getTime()) / 3600000);
    if (diffHours < 0) return 'Expired';
    if (diffHours < 24) return `⏱ ${diffHours}hrs left`;
    return `⏱ ${Math.floor(diffHours / 24)}d left`;
  };

  const getStatusCTA = (trade: Trade) => {
    const isInitiator = trade.initiator_id === profile?.id;
    switch (trade.status as TradeStatus) {
      case 'pending': return isInitiator ? 'Waiting for response' : 'Review offer →';
      case 'in_progress': return 'Negotiating →';
      case 'confirmed': return 'Arrange shipping →';
      case 'arrange_shipping': return 'Arrange shipping →';
      case 'shipping': return 'Track →';
      case 'delivered': return 'Mark received →';
      default: return 'View →';
    }
  };

  const getUserInitial = (user: any) => user?.display_name?.[0]?.toUpperCase() || '?';

  const getFilteredTrades = () => {
    if (!searchQuery.trim()) return trades;
    const q = searchQuery.toLowerCase();
    return trades.filter(trade => {
      const other = getOtherUser(trade) as any;
      return (
        other?.username?.toLowerCase().includes(q) ||
        other?.display_name?.toLowerCase().includes(q) ||
        trade.status.toLowerCase().includes(q)
      );
    });
  };

  const renderTrade = ({ item }: { item: Trade }) => {
    const otherUser = getOtherUser(item) as any;
    const direction = getTradeDirection(item);
    const timeAgo = getTimeAgo(item.updated_at);
    const expiryText = getExpiryText(item);
    const statusConfig = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
    const cta = getStatusCTA(item);
    const isActionable = ['pending', 'in_progress', 'confirmed', 'arrange_shipping', 'shipping', 'delivered'].includes(item.status) &&
      (item.status !== 'pending' || item.recipient_id === profile?.id);

    return (
      <TouchableOpacity
        style={[styles.tradeCard, { borderColor: statusConfig.border, backgroundColor: statusConfig.bg }]}
        onPress={() => router.push(`/trade/${item.id}`)}
        activeOpacity={0.7}
      >
        <View style={styles.tradeTop}>
          <View style={styles.tradeAvatar}>
            {otherUser?.avatar_url ? (
              <Image source={{ uri: otherUser.avatar_url }} style={styles.tradeAvatarImage} resizeMode="cover" />
            ) : (
              <Text style={styles.tradeAvatarText}>{getUserInitial(otherUser)}</Text>
            )}
          </View>
          <View style={styles.tradeInfo}>
            <Text style={styles.tradeUsername} numberOfLines={1}>@{otherUser?.username || 'unknown'}</Text>
            <Text style={styles.tradeTime}>{direction} · {timeAgo}</Text>
          </View>
          <View style={[styles.statusPill, { backgroundColor: statusConfig.bg, borderColor: statusConfig.border }]}>
            <Text style={[styles.statusPillText, { color: statusConfig.color }]}>{statusConfig.label}</Text>
          </View>
        </View>

        <View style={styles.pinPreview}>
          <View style={styles.pinThumbs}>
            {(item.offered_pin_ids?.slice(0, 2) || []).map((pinId, i) => (
              <View key={i} style={styles.pinThumb}>
                {pinImageUrls[pinId] ? (
                  <Image source={{ uri: pinImageUrls[pinId] }} style={styles.pinThumbImage} resizeMode="cover" />
                ) : (
                  <Text style={styles.pinThumbEmoji}>📌</Text>
                )}
              </View>
            ))}
            {(item.offered_pin_ids?.length || 0) > 2 && (
              <View style={[styles.pinThumb, styles.pinThumbMore]}>
                <Text style={styles.pinThumbMoreText}>+{(item.offered_pin_ids?.length || 0) - 2}</Text>
              </View>
            )}
          </View>
          <View style={styles.swapIcon}>
            <AntDesign name="swap" size={14} color="rgba(255,255,255,0.3)" />
          </View>
          <View style={styles.pinThumbs}>
            {(item.requested_pin_ids?.slice(0, 2) || []).map((pinId, i) => (
              <View key={i} style={styles.pinThumb}>
                {pinImageUrls[pinId] ? (
                  <Image source={{ uri: pinImageUrls[pinId] }} style={styles.pinThumbImage} resizeMode="cover" />
                ) : (
                  <Text style={styles.pinThumbEmoji}>📌</Text>
                )}
              </View>
            ))}
          </View>
        </View>

        <View style={styles.tradeFooter}>
          {expiryText ? (
            <Text style={styles.expiryText}>{expiryText}</Text>
          ) : (
            <Text style={styles.tradeOfferCount}>
              {item.offered_pin_ids?.length || 0} pin{(item.offered_pin_ids?.length || 0) !== 1 ? 's' : ''} offered
            </Text>
          )}
          <Text style={[styles.tradeCTA, isActionable && styles.tradeCTAActive]}>{cta}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const activeTrades = trades.filter(t => ACTIVE_STATUSES.includes(t.status));
  const filteredTrades = getFilteredTrades();

  return (
    <LinearGradient colors={['#0f1d6e', '#0b1554', '#08103d']} style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>

        {/* Header — matches Collection / Marketplace / Wishlist style */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <Text style={styles.headerTitle}>My Trades</Text>
            {activeTrades.length > 0 && (
              <View style={styles.headerBadge}>
                <Text style={styles.headerBadgeText}>{activeTrades.length} active</Text>
              </View>
            )}
          </View>

          {/* Search bar */}
          <View style={styles.searchBar}>
            <AntDesign name="search" size={14} color="rgba(255,255,255,0.4)" />
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search by username or status..."
              placeholderTextColor={Colors.textPlaceholder}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <AntDesign name="close" size={14} color="rgba(255,255,255,0.4)" />
              </TouchableOpacity>
            )}
          </View>

          {/* Tabs */}
          <View style={styles.tabs}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'active' && styles.tabActive]}
              onPress={() => setActiveTab('active')}
            >
              <Text style={[styles.tabText, activeTab === 'active' && styles.tabTextActive]}>Active</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'completed' && styles.tabActive]}
              onPress={() => setActiveTab('completed')}
            >
              <Text style={[styles.tabText, activeTab === 'completed' && styles.tabTextActive]}>Completed</Text>
            </TouchableOpacity>
          </View>
        </View>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.gold} />
          </View>
        ) : trades.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>🔄</Text>
            <Text style={styles.emptyTitle}>
              {activeTab === 'active' ? 'No active trades' : 'No completed trades yet'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {activeTab === 'active'
                ? 'Browse the Marketplace to find pins to trade!'
                : 'Completed trades will appear here.'}
            </Text>
            {activeTab === 'active' && (
              <TouchableOpacity style={styles.emptyButton} onPress={() => router.push('/(tabs)/marketplace')}>
                <Text style={styles.emptyButtonText}>Browse Marketplace</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : filteredTrades.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>🔍</Text>
            <Text style={styles.emptyTitle}>No results</Text>
            <Text style={styles.emptySubtitle}>No trades match "{searchQuery}"</Text>
            <TouchableOpacity style={styles.emptyButton} onPress={() => setSearchQuery('')}>
              <Text style={styles.emptyButtonText}>Clear search</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={filteredTrades}
            keyExtractor={item => item.id}
            renderItem={renderTrade}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.gold} />
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
  header: { backgroundColor: 'rgba(15,29,110,0.95)', padding: Theme.screenPadding, gap: Theme.spacing.md, borderBottomWidth: 0.5, borderBottomColor: 'rgba(245,197,24,0.12)' },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: Theme.fontSize.xxl, fontWeight: '500', color: Colors.textPrimary },
  headerBadge: { backgroundColor: Colors.goldFaint, borderWidth: 0.5, borderColor: Colors.goldBorder, borderRadius: Theme.radius.pill, paddingVertical: 3, paddingHorizontal: 10 },
  headerBadgeText: { fontSize: Theme.fontSize.sm, color: Colors.gold },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: Theme.spacing.sm, backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 0.5, borderColor: 'rgba(245,197,24,0.2)', borderRadius: Theme.radius.md, paddingHorizontal: Theme.spacing.md },
  searchInput: { flex: 1, paddingVertical: Theme.spacing.sm, color: Colors.textPrimary, fontSize: Theme.fontSize.sm },
  tabs: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: Theme.radius.md, padding: 3, gap: 3 },
  tab: { flex: 1, borderRadius: Theme.radius.sm, paddingVertical: 7, alignItems: 'center' },
  tabActive: { backgroundColor: Colors.goldFaint, borderWidth: 0.5, borderColor: 'rgba(245,197,24,0.35)' },
  tabText: { fontSize: Theme.fontSize.sm, color: Colors.textMuted },
  tabTextActive: { color: Colors.gold, fontWeight: '500' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Theme.screenPadding, gap: Theme.spacing.md },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { fontSize: Theme.fontSize.xl, fontWeight: '500', color: Colors.textPrimary, textAlign: 'center' },
  emptySubtitle: { fontSize: Theme.fontSize.sm, color: Colors.textMuted, textAlign: 'center', lineHeight: 20 },
  emptyButton: { backgroundColor: Colors.crimson, borderRadius: Theme.radius.pill, paddingVertical: Theme.spacing.sm, paddingHorizontal: Theme.spacing.xl, borderWidth: 1, borderColor: Colors.goldBorder, marginTop: Theme.spacing.sm },
  emptyButtonText: { color: Colors.textPrimary, fontSize: Theme.fontSize.md, fontWeight: '500' },
  listContent: { padding: Theme.screenPadding, paddingBottom: 100, gap: Theme.spacing.md },
  tradeCard: { borderRadius: Theme.radius.lg, padding: Theme.spacing.md, borderWidth: 0.5, gap: Theme.spacing.md },
  tradeTop: { flexDirection: 'row', alignItems: 'center', gap: Theme.spacing.sm },
  tradeAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.royalBlue, borderWidth: 1, borderColor: Colors.goldBorder, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  tradeAvatarImage: { width: '100%', height: '100%', borderRadius: 20 },
  tradeAvatarText: { fontSize: Theme.fontSize.md, fontWeight: '500', color: Colors.gold },
  tradeInfo: { flex: 1, gap: 2, minWidth: 0 },
  tradeUsername: { fontSize: Theme.fontSize.sm, fontWeight: '500', color: Colors.textPrimary },
  tradeTime: { fontSize: Theme.fontSize.xs, color: Colors.textMuted },
  statusPill: { borderRadius: Theme.radius.pill, borderWidth: 0.5, paddingVertical: 3, paddingHorizontal: 9, flexShrink: 0 },
  statusPillText: { fontSize: 9, fontWeight: '500' },
  pinPreview: { flexDirection: 'row', alignItems: 'center', gap: Theme.spacing.md },
  pinThumbs: { flexDirection: 'row', gap: 4 },
  pinThumb: { width: 36, height: 36, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 0.5, borderColor: 'rgba(245,197,24,0.2)', alignItems: 'center', justifyContent: 'center' },
  pinThumbImage: { width: '100%', height: '100%', borderRadius: 6 },
  pinThumbEmoji: { fontSize: 18 },
  pinThumbMore: { backgroundColor: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.1)' },
  pinThumbMoreText: { fontSize: Theme.fontSize.xs, color: Colors.textMuted },
  swapIcon: { flexShrink: 0 },
  tradeFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  expiryText: { fontSize: Theme.fontSize.xs, color: 'rgba(245,197,24,0.6)' },
  tradeOfferCount: { fontSize: Theme.fontSize.xs, color: Colors.textMuted },
  tradeCTA: { fontSize: Theme.fontSize.xs, color: Colors.textMuted },
  tradeCTAActive: { color: Colors.gold },
});