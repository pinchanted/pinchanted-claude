// ============================================================
// PINCHANTED — Marketplace Screen
// app/(tabs)/marketplace.tsx
// ============================================================

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
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { AntDesign } from '@expo/vector-icons';
import { useAuthStore } from '../../src/stores/auth.store';
import { supabase } from '../../src/lib/supabase';
import { Colors } from '../../src/constants/colors';
import { Theme } from '../../src/constants/theme';
import { MarketplaceListing } from '../../src/types/database.types';

type FilterType = 'all' | 'trade' | 'sale' | 'wishlist';

const FILTER_OPTIONS: { value: FilterType; label: string }[] = [
  { value: 'all', label: 'All listings' },
  { value: 'wishlist', label: '♥ Matches wishlist' },
  { value: 'trade', label: 'Trade only' },
  { value: 'sale', label: 'For sale' },
];

export default function MarketplaceScreen() {
  const { profile } = useAuthStore();
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [wishlistPinIds, setWishlistPinIds] = useState<string[]>([]);

  useEffect(() => {
    fetchWishlistPinIds();
    fetchListings();
  }, []);

  useEffect(() => {
    fetchListings();
  }, [filter]);

  const fetchWishlistPinIds = async () => {
    if (!profile?.id) return;
    const { data } = await supabase
      .from('collection_pins')
      .select('reference_pin_id, community_pin_id')
      .eq('user_id', profile.id)
      .eq('is_wishlisted', true);

    if (data) {
      const ids = data.flatMap(p => [
        p.reference_pin_id,
        p.community_pin_id,
      ]).filter(Boolean) as string[];
      setWishlistPinIds(ids);
    }
  };

  const fetchListings = async () => {
    if (!profile?.id) return;
    setIsLoading(true);

    let query = supabase
      .from('marketplace_listings')
      .select(`
        *,
        seller:profiles!seller_id(
          id, username, display_name, avatar_url,
          trade_rating, country,
          ship_domestically, ship_internationally
        ),
        collection_pin:collection_pins(
          *,
          reference_pin:reference_pins(*),
          community_pin:community_pins(*)
        )
      `)
      .eq('status', 'active')
      .neq('seller_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(40);

    if (filter === 'trade') {
      query = query.eq('open_to_trade', true);
    } else if (filter === 'sale') {
      query = query.eq('open_to_sale', true);
    }

    const { data, error } = await query;
    if (!error && data) {
      setListings(data as MarketplaceListing[]);
    }
    setIsLoading(false);
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchListings();
    setRefreshing(false);
  }, [profile?.id, filter]);

  const getPinName = (listing: MarketplaceListing) =>
    listing.collection_pin?.reference_pin?.name ||
    listing.collection_pin?.community_pin?.name ||
    'Unknown pin';

  const getPinSeries = (listing: MarketplaceListing) =>
    listing.collection_pin?.reference_pin?.series_name ||
    listing.collection_pin?.community_pin?.series_name || '';

  const isWishlistMatch = (listing: MarketplaceListing) => {
    const refId = listing.collection_pin?.reference_pin_id;
    const commId = listing.collection_pin?.community_pin_id;
    return (refId && wishlistPinIds.includes(refId)) ||
           (commId && wishlistPinIds.includes(commId));
  };

  const getFilteredListings = () => {
    let filtered = listings;
    if (filter === 'wishlist') {
      filtered = listings.filter(isWishlistMatch);
    }
    if (searchQuery) {
      filtered = filtered.filter(l =>
        getPinName(l).toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    return filtered;
  };

  const getShippingNote = (listing: MarketplaceListing) => {
    const seller = listing.seller as any;
    if (!seller) return '';
    const userCountry = profile?.country || 'CA';
    const sellerCountry = seller.country || 'CA';
    if (userCountry === sellerCountry) return '🇨🇦 Domestic';
    if (seller.ship_internationally) return '🌎 Ships internationally';
    return '';
  };

  const getSellerInitial = (listing: MarketplaceListing) => {
    const seller = listing.seller as any;
    return seller?.display_name?.[0]?.toUpperCase() || '?';
  };

  const renderListing = ({ item }: { item: MarketplaceListing }) => {
    const name = getPinName(item);
    const series = getPinSeries(item);
    const isMatch = isWishlistMatch(item);
    const shippingNote = getShippingNote(item);
    const seller = item.seller as any;

    return (
      <TouchableOpacity
        style={[styles.listingCard, isMatch && styles.listingCardMatch]}
        onPress={() => router.push(`/pin/${item.collection_pin_id}`)}
        activeOpacity={0.7}
      >
        {/* Wishlist match banner */}
        {isMatch && (
          <View style={styles.matchBanner}>
            <AntDesign name="heart" size={10} color={Colors.pink} />
            <Text style={styles.matchBannerText}>
              Matches your wishlist
            </Text>
          </View>
        )}

        {/* Pin image */}
        <View style={styles.pinImageWrap}>
          <Text style={styles.pinPlaceholder}>📌</Text>
        </View>

        {/* Pin info */}
        <View style={styles.pinInfo}>
          <Text style={styles.pinName} numberOfLines={2}>{name}</Text>
          {series ? (
            <Text style={styles.pinSeries} numberOfLines={1}>
              {series}
            </Text>
          ) : null}

          {/* Type tags */}
          <View style={styles.typeTags}>
            {item.open_to_trade && (
              <View style={styles.tradeTag}>
                <Text style={styles.tradeTagText}>Trade</Text>
              </View>
            )}
            {item.open_to_sale && item.asking_price && (
              <View style={styles.saleTag}>
                <Text style={styles.saleTagText}>
                  ${item.asking_price.toFixed(0)}
                </Text>
              </View>
            )}
          </View>

          {/* Seller */}
          <View style={styles.sellerRow}>
            <View style={styles.sellerAvatar}>
              <Text style={styles.sellerAvatarText}>
                {getSellerInitial(item)}
              </Text>
            </View>
            <Text style={styles.sellerName} numberOfLines={1}>
              @{seller?.username || 'unknown'}
            </Text>
            {seller?.trade_rating > 0 && (
              <View style={styles.ratingPill}>
                <AntDesign name="star" size={9} color={Colors.gold} />
                <Text style={styles.ratingText}>
                  {seller.trade_rating.toFixed(1)}
                </Text>
              </View>
            )}
          </View>

          {/* Shipping */}
          {shippingNote ? (
            <Text style={styles.shippingNote}>{shippingNote}</Text>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  const filteredListings = getFilteredListings();

  return (
    <LinearGradient
      colors={['#0f1d6e', '#0b1554', '#08103d']}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea}>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <Text style={styles.headerTitle}>Marketplace</Text>
            <View style={styles.headerBadge}>
              <Text style={styles.headerBadgeText}>
                {filteredListings.length} listings
              </Text>
            </View>
          </View>

          {/* Search */}
          <View style={styles.searchBar}>
            <AntDesign
              name="search"
              size={14}
              color="rgba(255,255,255,0.4)"
            />
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search listings..."
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

          {/* Filter chips */}
          <View style={styles.filterChips}>
            {FILTER_OPTIONS.map(option => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.filterChip,
                  filter === option.value && styles.filterChipActive,
                ]}
                onPress={() => setFilter(option.value)}
              >
                <Text style={[
                  styles.filterChipText,
                  filter === option.value && styles.filterChipTextActive,
                ]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Marketplace note */}
        <View style={styles.marketplaceNote}>
          <AntDesign
            name="info-circle"
            size={12}
            color="rgba(255,255,255,0.35)"
          />
          <Text style={styles.marketplaceNoteText}>
            {profile?.ship_domestically && !profile?.ship_internationally
              ? `Showing ${profile.country === 'CA' ? '🇨🇦 Canadian' : '🇺🇸 US'} listings only · `
              : 'Showing all listings · '}
            <Text style={styles.marketplaceNoteLink}>
              Change in Settings
            </Text>
          </Text>
        </View>

        {/* Content */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.gold} />
          </View>
        ) : filteredListings.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>🛒</Text>
            <Text style={styles.emptyTitle}>No listings found</Text>
            <Text style={styles.emptySubtitle}>
              {filter === 'wishlist'
                ? 'None of your wishlisted pins are currently listed. We\'ll notify you when they appear!'
                : 'Check back soon — new pins are listed every day!'}
            </Text>
            {filter !== 'all' && (
              <TouchableOpacity
                style={styles.emptyButton}
                onPress={() => setFilter('all')}
              >
                <Text style={styles.emptyButtonText}>Show all listings</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <FlatList
            data={filteredListings}
            keyExtractor={item => item.id}
            renderItem={renderListing}
            numColumns={2}
            columnWrapperStyle={styles.columnWrapper}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={Colors.gold}
              />
            }
          />
        )}

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

  // Filter chips
  filterChips: {
    flexDirection: 'row',
    gap: Theme.spacing.xs,
    flexWrap: 'wrap',
  },
  filterChip: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: Theme.radius.pill,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  filterChipActive: {
    backgroundColor: Colors.goldFaint,
    borderColor: 'rgba(245,197,24,0.45)',
  },
  filterChipText: {
    fontSize: Theme.fontSize.xs,
    color: Colors.textMuted,
  },
  filterChipTextActive: {
    color: Colors.gold,
    fontWeight: '500',
  },

  // Marketplace note
  marketplaceNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.xs,
    paddingHorizontal: Theme.screenPadding,
    paddingVertical: Theme.spacing.sm,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  marketplaceNoteText: {
    fontSize: Theme.fontSize.xs,
    color: Colors.textFaint,
  },
  marketplaceNoteLink: {
    color: Colors.gold,
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

  // List
  listContent: {
    padding: Theme.screenPadding,
    paddingBottom: 100,
    gap: Theme.spacing.md,
  },
  columnWrapper: {
    gap: Theme.spacing.md,
  },

  // Listing card
  listingCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 0.5,
    borderColor: 'rgba(245,197,24,0.15)',
    borderRadius: Theme.radius.md,
    overflow: 'hidden',
  },
  listingCardMatch: {
    borderColor: Colors.pinkBorder,
    backgroundColor: 'rgba(249,200,216,0.05)',
  },

  // Match banner
  matchBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.pinkFaint,
    paddingVertical: 4,
    paddingHorizontal: Theme.spacing.sm,
  },
  matchBannerText: {
    fontSize: 9,
    color: Colors.pink,
    fontWeight: '500',
  },

  // Pin image
  pinImageWrap: {
    aspectRatio: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinPlaceholder: {
    fontSize: 36,
  },

  // Pin info
  pinInfo: {
    padding: Theme.spacing.sm,
    gap: Theme.spacing.xs,
  },
  pinName: {
    fontSize: Theme.fontSize.sm,
    fontWeight: '500',
    color: Colors.textPrimary,
    lineHeight: 16,
  },
  pinSeries: {
    fontSize: Theme.fontSize.xs,
    color: Colors.gold,
    opacity: 0.65,
  },

  // Type tags
  typeTags: {
    flexDirection: 'row',
    gap: 4,
    flexWrap: 'wrap',
  },
  tradeTag: {
    backgroundColor: 'rgba(93,202,122,0.12)',
    borderWidth: 0.5,
    borderColor: 'rgba(93,202,122,0.3)',
    borderRadius: Theme.radius.pill,
    paddingVertical: 2,
    paddingHorizontal: 7,
  },
  tradeTagText: {
    fontSize: 8,
    color: Colors.success,
    fontWeight: '500',
  },
  saleTag: {
    backgroundColor: Colors.goldFaint,
    borderWidth: 0.5,
    borderColor: Colors.goldBorder,
    borderRadius: Theme.radius.pill,
    paddingVertical: 2,
    paddingHorizontal: 7,
  },
  saleTagText: {
    fontSize: 8,
    color: Colors.gold,
    fontWeight: '500',
  },

  // Seller
  sellerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  sellerAvatar: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.royalBlue,
    borderWidth: 0.5,
    borderColor: Colors.goldBorder,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  sellerAvatarText: {
    fontSize: 8,
    color: Colors.gold,
    fontWeight: '500',
  },
  sellerName: {
    fontSize: Theme.fontSize.xs,
    color: Colors.textMuted,
    flex: 1,
  },
  ratingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    flexShrink: 0,
  },
  ratingText: {
    fontSize: 9,
    color: Colors.gold,
  },

  // Shipping note
  shippingNote: {
    fontSize: 9,
    color: Colors.textFaint,
  },
});