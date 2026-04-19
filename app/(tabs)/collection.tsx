// ============================================================
// PINCHANTED — Collection Screen
// app/(tabs)/collection.tsx
// ============================================================

import { getPinImageUrl } from '../../src/lib/supabase';
import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Image
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { AntDesign } from '@expo/vector-icons';
import { useAuthStore } from '../../src/stores/auth.store';
import { useCollectionStore } from '../../src/stores/collection.store';
import { Colors } from '../../src/constants/colors';
import { Theme } from '../../src/constants/theme';
import { CollectionPin } from '../../src/types/database.types';

type GroupBy = 'series' | 'theme' | 'trade_status' | 'all';

const GROUP_OPTIONS: { value: GroupBy; label: string }[] = [
  { value: 'series', label: 'By Series' },
  { value: 'theme', label: 'By Theme' },
  { value: 'trade_status', label: 'Trade Status' },
  { value: 'all', label: 'All pins' },
];

const TRADE_STATUS_ORDER = [
  '🔴 Committed',
  '🟡 On the table',
  '🔵 Wanted by others',
  '✅ Available',
];

// Pin image component that handles Supabase Storage URLs
const PinImage = ({
  path,
  style,
}: {
  path: string;
  style: any;
}) => {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    getPinImageUrl(path).then(setUrl);
  }, [path]);

  if (!url) return <Text style={{ fontSize: 32 }}>📌</Text>;
  return (
    <Image
      source={{ uri: url }}
      style={style}
      resizeMode="cover"
    />
  );
};

export default function CollectionScreen() {
  const { profile } = useAuthStore();
  const {
    pins,
    isLoading,
    groupBy,
    searchQuery,
    groupedPins,
    tradeStatusCounts,
    fetchCollection,
    setGroupBy,
    setSearchQuery,
  } = useCollectionStore();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (profile?.id) {
      fetchCollection(profile.id);
    }
  }, [profile?.id]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (profile?.id) await fetchCollection(profile.id);
    setRefreshing(false);
  }, [profile?.id]);

  const getPinName = (pin: CollectionPin) =>
    pin.reference_pin?.name || pin.community_pin?.name || 'Unknown pin';

  const getPinSeries = (pin: CollectionPin) =>
    pin.reference_pin?.series_name || pin.community_pin?.series_name || '';

  const getPinEdition = (pin: CollectionPin) =>
    pin.reference_pin?.edition || pin.community_pin?.edition || '';

  const getEditionBadge = (edition: string) => {
    if (edition === 'Limited Edition') return { label: 'LE', color: Colors.error, bg: Colors.errorFaint };
    if (edition === 'Open Edition') return { label: 'OE', color: Colors.success, bg: Colors.successFaint };
    if (edition === 'Limited Release') return { label: 'LR', color: '#c4b5fd', bg: 'rgba(124,58,237,0.15)' };
    return null;
  };

  const getTradeStatusStyle = (status: string) => {
    switch (status) {
      case 'on_table': return { border: Colors.onTableBorder, bg: Colors.onTableFaint };
      case 'requested': return { border: Colors.wantedBorder, bg: Colors.wantedFaint };
      case 'committed': return { border: Colors.committedBorder, bg: Colors.committedFaint };
      default: return { border: Colors.surfaceBorder, bg: Colors.surface };
    }
  };

  const renderPin = ({ item }: { item: CollectionPin }) => {
    const name = getPinName(item);
    const series = getPinSeries(item);
    const edition = getPinEdition(item);
    const editionBadge = getEditionBadge(edition);
    const tradeStyle = getTradeStatusStyle(item.trade_status);
    const isCommitted = item.trade_status === 'committed';

    return (
      <TouchableOpacity
        style={[
          styles.pinCard,
          { borderColor: tradeStyle.border, backgroundColor: tradeStyle.bg },
        ]}
        onPress={() => router.push(`/pin/${item.id}`)}
        activeOpacity={0.7}
      >
{/* Pin image */}
<View style={[
  styles.pinImageWrap,
  isCommitted && styles.pinImageCommitted,
]}>
  {item.my_image_path ? (
    <PinImage
      path={item.my_image_path}
      style={styles.pinImage}
    />
  ) : (
    <Text style={styles.pinPlaceholder}>📌</Text>
  )}

          {/* Edition badge */}
          {editionBadge && (
            <View style={[styles.editionBadge,
              { backgroundColor: editionBadge.bg,
                borderColor: editionBadge.color }]}>
              <Text style={[styles.editionBadgeText,
                { color: editionBadge.color }]}>
                {editionBadge.label}
              </Text>
            </View>
          )}

          {/* Wishlist heart */}
          {item.is_wishlisted && (
            <View style={styles.wishlistDot}>
              <AntDesign name="heart" size={8} color={Colors.pink} />
            </View>
          )}

          {/* Trade status badge */}
          {item.trade_status === 'on_table' && (
            <View style={styles.tradeStatusBadge}>
              <Text style={styles.tradeStatusDot}>🟡</Text>
            </View>
          )}
          {item.trade_status === 'requested' && (
            <View style={styles.tradeStatusBadge}>
              <Text style={styles.tradeStatusDot}>🔵</Text>
            </View>
          )}
          {item.trade_status === 'committed' && (
            <View style={styles.tradeStatusBadge}>
              <Text style={styles.tradeStatusDot}>🔴</Text>
            </View>
          )}
        </View>

        {/* Pin info */}
        <View style={styles.pinInfo}>
          <Text
            style={[styles.pinName, isCommitted && styles.pinNameMuted]}
            numberOfLines={2}
          >
            {name}
          </Text>
          {series ? (
            <Text style={styles.pinSeries} numberOfLines={1}>
              {series}
            </Text>
          ) : null}
          {item.my_purchase_price ? (
            <Text style={[styles.pinValue,
              isCommitted && styles.pinValueMuted]}>
              ${item.my_purchase_price.toFixed(2)}
            </Text>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  const renderGroup = (groupName: string, groupPins: CollectionPin[]) => {
    if (groupPins.length === 0) return null;
    return (
      <View key={groupName} style={styles.group}>
        <View style={styles.groupHeader}>
          <Text style={styles.groupName}>{groupName}</Text>
          <View style={styles.groupLine} />
          <Text style={styles.groupCount}>{groupPins.length} pins</Text>
        </View>
        <View style={styles.pinGrid}>
          {groupPins.map(pin => (
            <View key={pin.id} style={styles.pinCardWrapper}>
              {renderPin({ item: pin })}
            </View>
          ))}
        </View>
      </View>
    );
  };

  const renderTradeStatusBanner = () => {
    if (groupBy !== 'trade_status') return null;
    return (
      <View style={styles.tradeStatusBanner}>
        <View style={styles.bannerStat}>
          <Text style={[styles.bannerNum, { color: Colors.committed }]}>
            {tradeStatusCounts.committed}
          </Text>
          <Text style={[styles.bannerLabel, { color: 'rgba(255,138,149,0.55)' }]}>
            Committed
          </Text>
        </View>
        <View style={styles.bannerStat}>
          <Text style={[styles.bannerNum, { color: Colors.onTable }]}>
            {tradeStatusCounts.on_table}
          </Text>
          <Text style={[styles.bannerLabel, { color: 'rgba(245,197,24,0.55)' }]}>
            On table
          </Text>
        </View>
        <View style={styles.bannerStat}>
          <Text style={[styles.bannerNum, { color: Colors.wanted }]}>
            {tradeStatusCounts.requested}
          </Text>
          <Text style={[styles.bannerLabel, { color: 'rgba(147,197,253,0.55)' }]}>
            Wanted
          </Text>
        </View>
        <View style={styles.bannerStat}>
          <Text style={[styles.bannerNum,
            { color: Colors.textSecondary }]}>
            {tradeStatusCounts.available}
          </Text>
          <Text style={[styles.bannerLabel,
            { color: Colors.textMuted }]}>
            Available
          </Text>
        </View>
      </View>
    );
  };

  const getGroupOrder = () => {
    if (groupBy === 'trade_status') {
      return TRADE_STATUS_ORDER.filter(key => groupedPins[key]?.length > 0);
    }
    return Object.keys(groupedPins).sort();
  };

  return (
    <LinearGradient
      colors={['#0f1d6e', '#0b1554', '#08103d']}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea}>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <Text style={styles.headerTitle}>My Collection</Text>
            <View style={styles.headerBadge}>
              <Text style={styles.headerBadgeText}>{pins.length} pins</Text>
            </View>
          </View>

          {/* Search */}
          <View style={styles.searchBar}>
            <AntDesign name="search" size={14} color="rgba(255,255,255,0.4)" />
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search your collection..."
              placeholderTextColor={Colors.textPlaceholder}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <AntDesign
                  name="close"
                  size={14}
                  color="rgba(255,255,255,0.4)"
                />
              </TouchableOpacity>
            )}
          </View>

          {/* Group chips */}
          <View style={styles.groupChips}>
            {GROUP_OPTIONS.map(option => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.groupChip,
                  groupBy === option.value && styles.groupChipActive,
                ]}
                onPress={() => setGroupBy(option.value as GroupBy)}
              >
                <Text style={[
                  styles.groupChipText,
                  groupBy === option.value && styles.groupChipTextActive,
                ]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Trade status banner */}
        {renderTradeStatusBanner()}

        {/* Content */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.gold} />
          </View>
        ) : pins.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>📌</Text>
            <Text style={styles.emptyTitle}>Your collection is empty</Text>
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
          <FlatList
            data={[1]}
            keyExtractor={() => 'collection'}
            renderItem={() => (
              <View style={styles.collectionContent}>
                {getGroupOrder().map(groupName =>
                  renderGroup(groupName, groupedPins[groupName] || [])
                )}
              </View>
            )}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={Colors.gold}
              />
            }
            showsVerticalScrollIndicator={false}
          />
        )}

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

  // Header
  header: {
    backgroundColor: 'rgba(15,29,110,0.95)',
    padding: Theme.screenPadding,
    paddingTop: Theme.spacing.xl,
    gap: Theme.spacing.md,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(245,197,24,0.12)',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: Theme.fontSize.xxl,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  headerBadge: {
    backgroundColor: Colors.goldFaint,
    borderWidth: 0.5,
    borderColor: Colors.goldBorder,
    borderRadius: Theme.radius.pill,
    paddingVertical: 3,
    paddingHorizontal: 10,
  },
  headerBadgeText: {
    fontSize: Theme.fontSize.sm,
    color: Colors.gold,
  },

  // Search
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 0.5,
    borderColor: 'rgba(245,197,24,0.2)',
    borderRadius: Theme.radius.md,
    paddingHorizontal: Theme.spacing.md,
  },
  searchInput: {
    flex: 1,
    paddingVertical: Theme.spacing.sm,
    color: Colors.textPrimary,
    fontSize: Theme.fontSize.sm,
  },

  // Group chips
  groupChips: {
    flexDirection: 'row',
    gap: Theme.spacing.xs,
  },
  groupChip: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: Theme.radius.pill,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  groupChipActive: {
    backgroundColor: Colors.goldFaint,
    borderColor: 'rgba(245,197,24,0.45)',
  },
  groupChipText: {
    fontSize: Theme.fontSize.xs,
    color: Colors.textMuted,
  },
  groupChipTextActive: {
    color: Colors.gold,
    fontWeight: '500',
  },

  // Trade status banner
  tradeStatusBanner: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(245,197,24,0.12)',
    padding: Theme.spacing.md,
  },
  bannerStat: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  bannerNum: {
    fontSize: 20,
    fontWeight: '500',
    lineHeight: 24,
  },
  bannerLabel: {
    fontSize: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Loading
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Empty state
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Theme.screenPadding,
    gap: Theme.spacing.md,
  },
  emptyEmoji: {
    fontSize: 48,
  },
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
  emptyButton: {
    backgroundColor: Colors.crimson,
    borderRadius: Theme.radius.pill,
    paddingVertical: Theme.spacing.sm,
    paddingHorizontal: Theme.spacing.xl,
    borderWidth: 1,
    borderColor: Colors.goldBorder,
    marginTop: Theme.spacing.sm,
  },
  emptyButtonText: {
    color: Colors.textPrimary,
    fontSize: Theme.fontSize.md,
    fontWeight: '500',
  },

  // Collection content
  collectionContent: {
    padding: Theme.screenPadding,
    paddingBottom: 100,
    gap: Theme.spacing.lg,
  },

  // Group
  group: {
    gap: Theme.spacing.md,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  groupName: {
    fontSize: Theme.fontSize.sm,
    fontWeight: '500',
    color: Colors.textPrimary,
    whiteSpace: 'nowrap',
  } as any,
  groupLine: {
    flex: 1,
    height: 0.5,
    backgroundColor: 'rgba(245,197,24,0.15)',
  },
  groupCount: {
    fontSize: Theme.fontSize.xs,
    color: Colors.textMuted,
    whiteSpace: 'nowrap',
  } as any,

  // Pin grid
  pinGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Theme.spacing.sm,
  },
  pinCardWrapper: {
    width: '31%',
  },

  pinImage: {
  width: '100%',
  height: '100%',
},
  // Pin card
  pinCard: {
    borderRadius: Theme.radius.md,
    overflow: 'hidden',
    borderWidth: 0.5,
  },
  pinImageWrap: {
    aspectRatio: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  pinImageCommitted: {
    opacity: 0.5,
  },
  pinPlaceholder: {
    fontSize: 32,
  },
  editionBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    borderRadius: Theme.radius.pill,
    borderWidth: 0.5,
    paddingVertical: 1,
    paddingHorizontal: 5,
  },
  editionBadgeText: {
    fontSize: 7,
    fontWeight: '500',
  },
  wishlistDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.pinkFaint,
    borderWidth: 0.5,
    borderColor: Colors.pinkBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tradeStatusBadge: {
    position: 'absolute',
    bottom: 3,
    left: 3,
  },
  tradeStatusDot: {
    fontSize: 10,
  },

  // Pin info
  pinInfo: {
    padding: 6,
    gap: 2,
  },
  pinName: {
    fontSize: 8,
    color: Colors.textPrimary,
    lineHeight: 11,
  },
  pinNameMuted: {
    color: Colors.textMuted,
  },
  pinSeries: {
    fontSize: 7,
    color: Colors.gold,
    opacity: 0.65,
  },
  pinValue: {
    fontSize: 8,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  pinValueMuted: {
    color: Colors.textFaint,
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