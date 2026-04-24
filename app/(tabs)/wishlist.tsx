// ============================================================
// PINCHANTED — Wishlist Screen
// app/(tabs)/wishlist.tsx
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { AntDesign } from '@expo/vector-icons';
import { useAuthStore } from '../../src/stores/auth.store';
import { supabase } from '../../src/lib/supabase';
import { Colors } from '../../src/constants/colors';
import { Theme } from '../../src/constants/theme';
import { CollectionPin } from '../../src/types/database.types';

export default function WishlistScreen() {
  const { profile } = useAuthStore();
  const [wishlistPins, setWishlistPins] = useState<CollectionPin[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchWishlist();
  }, [profile?.id]);

  const fetchWishlist = async () => {
    if (!profile?.id) {
      setIsLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('collection_pins')
      .select(`
        *,
        reference_pin:reference_pins(*),
        community_pin:community_pins(*)
      `)
      .eq('user_id', profile.id)
      .eq('is_wishlisted', true)
      .eq('is_deleted', false)
      .order('added_at', { ascending: false });

    if (!error && data) {
      setWishlistPins(data as CollectionPin[]);
    }
    setIsLoading(false);
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchWishlist();
    setRefreshing(false);
  }, [profile?.id]);

  const removeFromWishlist = async (pinId: string) => {
    await supabase
      .from('collection_pins')
      .update({ is_wishlisted: false })
      .eq('id', pinId);
    setWishlistPins(prev => prev.filter(p => p.id !== pinId));
  };

  const getPinName = (pin: CollectionPin) =>
    pin.reference_pin?.name || pin.community_pin?.name || 'Unknown pin';

  const getPinSeries = (pin: CollectionPin) =>
    pin.reference_pin?.series_name ||
    pin.community_pin?.series_name || '';

  const getPinEdition = (pin: CollectionPin) =>
    pin.reference_pin?.edition ||
    pin.community_pin?.edition || '';

  const getEditionBadge = (edition: string) => {
    if (edition === 'Limited Edition')
      return { label: 'LE', color: Colors.error, bg: Colors.errorFaint };
    if (edition === 'Open Edition')
      return { label: 'OE', color: Colors.success, bg: Colors.successFaint };
    if (edition === 'Limited Release')
      return { label: 'LR', color: '#c4b5fd', bg: 'rgba(124,58,237,0.15)' };
    return null;
  };

  const renderPin = ({ item }: { item: CollectionPin }) => {
    const name = getPinName(item);
    const series = getPinSeries(item);
    const edition = getPinEdition(item);
    const editionBadge = getEditionBadge(edition);

    return (
      <View style={styles.pinCard}>
        {/* Pin image */}
        <TouchableOpacity
          style={styles.pinImageWrap}
          onPress={() => router.push(`/pin/${item.id}`)}
          activeOpacity={0.7}
        >
          <Text style={styles.pinPlaceholder}>📌</Text>
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
        </TouchableOpacity>

        {/* Pin info */}
        <View style={styles.pinInfo}>
          <Text style={styles.pinName} numberOfLines={2}>{name}</Text>
          {series ? (
            <Text style={styles.pinSeries} numberOfLines={1}>
              {series}
            </Text>
          ) : null}
          {item.my_purchase_price ? (
            <Text style={styles.pinValue}>
              Est. ${item.my_purchase_price.toFixed(2)}
            </Text>
          ) : null}

          {/* Actions */}
          <View style={styles.pinActions}>
            <TouchableOpacity
              style={styles.findButton}
              onPress={() => router.push('/(tabs)/marketplace')}
            >
              <AntDesign name="search" size={11} color={Colors.gold} />
              <Text style={styles.findButtonText}>Find to trade</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.removeButton}
              onPress={() => removeFromWishlist(item.id)}
            >
              <AntDesign name="heart" size={11} color={Colors.pink} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
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
            <Text style={styles.headerTitle}>Wishlist</Text>
            <View style={styles.headerBadge}>
              <Text style={styles.headerBadgeText}>
                {wishlistPins.length} pins
              </Text>
            </View>
          </View>
          <Text style={styles.headerSubtitle}>
            Pins you're looking for · we'll notify you when they're listed
          </Text>
        </View>

        {/* Content */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.gold} />
          </View>
        ) : wishlistPins.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>💖</Text>
            <Text style={styles.emptyTitle}>Your wishlist is empty</Text>
            <Text style={styles.emptySubtitle}>
              Tap the ♥ heart on any pin in your collection or the
              Marketplace to add it to your wishlist
            </Text>
            <TouchableOpacity
              style={styles.emptyButton}
              onPress={() => router.push('/(tabs)/marketplace')}
            >
              <Text style={styles.emptyButtonText}>Browse Marketplace</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={wishlistPins}
            keyExtractor={item => item.id}
            renderItem={renderPin}
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
    paddingTop: Theme.spacing.md,
    gap: Theme.spacing.sm,
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
    backgroundColor: Colors.pinkFaint,
    borderWidth: 0.5,
    borderColor: Colors.pinkBorder,
    borderRadius: Theme.radius.pill,
    paddingVertical: 3,
    paddingHorizontal: 10,
  },
  headerBadgeText: {
    fontSize: Theme.fontSize.sm,
    color: Colors.pink,
  },
  headerSubtitle: {
    fontSize: Theme.fontSize.sm,
    color: Colors.textMuted,
    lineHeight: 18,
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

  // Pin card
  pinCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 0.5,
    borderColor: Colors.pinkBorder,
    borderRadius: Theme.radius.md,
    overflow: 'hidden',
  },
  pinImageWrap: {
    aspectRatio: 1,
    backgroundColor: 'rgba(249,200,216,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  pinPlaceholder: {
    fontSize: 36,
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
  pinValue: {
    fontSize: Theme.fontSize.xs,
    color: Colors.textSecondary,
  },

  // Actions
  pinActions: {
    flexDirection: 'row',
    gap: Theme.spacing.xs,
    marginTop: Theme.spacing.xs,
  },
  findButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: Colors.goldFaint,
    borderWidth: 0.5,
    borderColor: Colors.goldBorder,
    borderRadius: Theme.radius.pill,
    paddingVertical: 5,
  },
  findButtonText: {
    fontSize: 9,
    color: Colors.gold,
    fontWeight: '500',
  },
  removeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.pinkFaint,
    borderWidth: 0.5,
    borderColor: Colors.pinkBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
});