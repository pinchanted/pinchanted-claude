// ============================================================
// PINCHANTED — Wishlist Screen
// app/(tabs)/wishlist.tsx
//
// Shows pins from OTHER users that this user has wishlisted
// from the Marketplace. Each entry links directly to the
// specific collection_pins record the user wants.
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

interface WishlistItem {
  wishlist_id: string;
  collection_pin_id: string;
  owner_username: string | null;
  owner_avatar: string | null;
  name: string;
  series_name: string | null;
  edition: string | null;
  condition: string | null;
  image_url: string | null;
}

const EDITION_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  'Limited Edition': { label: 'LE', color: Colors.error, bg: Colors.errorFaint },
  'Open Edition': { label: 'OE', color: Colors.success, bg: Colors.successFaint },
  'Limited Release': { label: 'LR', color: '#c4b5fd', bg: 'rgba(124,58,237,0.15)' },
};

export default function WishlistScreen() {
  const { profile } = useAuthStore();
  const [items, setItems] = useState<WishlistItem[]>([]);
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
      .from('user_wishlist')
      .select(`
        id,
        collection_pin_id,
        collection_pin:collection_pins(
          id,
          my_image_path,
          condition,
          override_name,
          override_series_name,
          override_edition,
          user_id,
          owner:profiles!user_id(username, avatar_url),
          reference_pin:reference_pins(name, series_name, edition, image_url, stored_image_path),
          community_pin:community_pins(name, series_name, edition, image_path)
        )
      `)
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Wishlist fetch error:', error);
      setIsLoading(false);
      return;
    }

    const mapped: WishlistItem[] = (data || []).map((entry: any) => {
      const cp = entry.collection_pin;
      const ref = cp?.reference_pin;
      const com = cp?.community_pin;
      const owner = cp?.owner;

      // Coalesce: override → reference_pin → community_pin
      const name = cp?.override_name ?? ref?.name ?? com?.name ?? 'Unknown pin';
      const series = cp?.override_series_name ?? ref?.series_name ?? com?.series_name ?? null;
      const edition = cp?.override_edition ?? ref?.edition ?? com?.edition ?? null;

      // Image: owner's photo first, then reference db image
      const rawPath = cp?.my_image_path;
      const refImg = ref?.image_url || ref?.stored_image_path || com?.image_path || null;
      const image_url = rawPath ? getPinImageUrl(rawPath) : refImg;

      return {
        wishlist_id: entry.id,
        collection_pin_id: entry.collection_pin_id,
        owner_username: owner?.username ?? null,
        owner_avatar: owner?.avatar_url ?? null,
        name,
        series_name: series,
        edition,
        condition: cp?.condition ?? null,
        image_url,
      };
    });

    setItems(mapped);
    setIsLoading(false);
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchWishlist();
    setRefreshing(false);
  }, [profile?.id]);

  const removeFromWishlist = async (wishlistId: string) => {
    await supabase.from('user_wishlist').delete().eq('id', wishlistId);
    setItems(prev => prev.filter(i => i.wishlist_id !== wishlistId));
  };

  const renderItem = ({ item }: { item: WishlistItem }) => {
    const editionConfig = item.edition ? EDITION_CONFIG[item.edition] : null;
    return (
      <View style={styles.pinCard}>
        <TouchableOpacity
          style={styles.pinImageWrap}
          onPress={() => router.push(`/pin/${item.collection_pin_id}?fromMarketplace=true` as any)}
          activeOpacity={0.7}
        >
          {item.image_url ? (
            <Image source={{ uri: item.image_url }} style={styles.pinImage} resizeMode="cover" />
          ) : (
            <Text style={styles.pinPlaceholder}>📌</Text>
          )}
          {editionConfig && (
            <View style={[styles.editionBadge, { backgroundColor: editionConfig.bg, borderColor: editionConfig.color }]}>
              <Text style={[styles.editionBadgeText, { color: editionConfig.color }]}>{editionConfig.label}</Text>
            </View>
          )}
        </TouchableOpacity>

        <View style={styles.pinInfo}>
          <Text style={styles.pinName} numberOfLines={2}>{item.name}</Text>
          {item.series_name && <Text style={styles.pinSeries} numberOfLines={1}>{item.series_name}</Text>}
          {item.owner_username && (
            <Text style={styles.pinOwner} numberOfLines={1}>@{item.owner_username}</Text>
          )}
          {item.condition && <Text style={styles.pinCondition}>{item.condition}</Text>}

          <View style={styles.pinActions}>
            <TouchableOpacity
              style={styles.tradeButton}
              onPress={() => router.push(`/pin/${item.collection_pin_id}?fromMarketplace=true` as any)}
            >
              <AntDesign name="swap" size={11} color={Colors.gold} />
              <Text style={styles.tradeButtonText}>Propose trade</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.removeButton}
              onPress={() => removeFromWishlist(item.wishlist_id)}
            >
              <AntDesign name="heart" size={11} color={Colors.pink} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <LinearGradient colors={['#0f1d6e', '#0b1554', '#08103d']} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <Text style={styles.headerTitle}>Wishlist</Text>
            <View style={styles.headerBadge}>
              <Text style={styles.headerBadgeText}>{items.length} pins</Text>
            </View>
          </View>
          <Text style={styles.headerSubtitle}>
            Pins from other collectors you want · tap to propose a trade
          </Text>
        </View>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.gold} />
          </View>
        ) : items.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>💖</Text>
            <Text style={styles.emptyTitle}>Your wishlist is empty</Text>
            <Text style={styles.emptySubtitle}>
              Browse the Marketplace and tap the heart on any pin you want to add it to your wishlist
            </Text>
            <TouchableOpacity
              style={styles.emptyButton}
              onPress={() => router.push('/(tabs)/marketplace' as any)}
            >
              <Text style={styles.emptyButtonText}>Browse Marketplace</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={item => item.wishlist_id}
            renderItem={renderItem}
            numColumns={2}
            columnWrapperStyle={styles.columnWrapper}
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
  header: { backgroundColor: 'rgba(15,29,110,0.95)', padding: Theme.screenPadding, paddingTop: Theme.spacing.md, gap: Theme.spacing.sm, borderBottomWidth: 0.5, borderBottomColor: 'rgba(245,197,24,0.12)' },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: Theme.fontSize.xxl, fontWeight: '500', color: Colors.textPrimary },
  headerBadge: { backgroundColor: Colors.pinkFaint, borderWidth: 0.5, borderColor: Colors.pinkBorder, borderRadius: Theme.radius.pill, paddingVertical: 3, paddingHorizontal: 10 },
  headerBadgeText: { fontSize: Theme.fontSize.sm, color: Colors.pink },
  headerSubtitle: { fontSize: Theme.fontSize.sm, color: Colors.textMuted, lineHeight: 18 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Theme.screenPadding, gap: Theme.spacing.md },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { fontSize: Theme.fontSize.xl, fontWeight: '500', color: Colors.textPrimary, textAlign: 'center' },
  emptySubtitle: { fontSize: Theme.fontSize.sm, color: Colors.textMuted, textAlign: 'center', lineHeight: 20 },
  emptyButton: { backgroundColor: Colors.crimson, borderRadius: Theme.radius.pill, paddingVertical: Theme.spacing.sm, paddingHorizontal: Theme.spacing.xl, borderWidth: 1, borderColor: Colors.goldBorder, marginTop: Theme.spacing.sm },
  emptyButtonText: { color: Colors.textPrimary, fontSize: Theme.fontSize.md, fontWeight: '500' },
  listContent: { padding: Theme.screenPadding, paddingBottom: 100, gap: Theme.spacing.md },
  columnWrapper: { gap: Theme.spacing.md },
  pinCard: { flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 0.5, borderColor: Colors.pinkBorder, borderRadius: Theme.radius.md, overflow: 'hidden' },
  pinImageWrap: { aspectRatio: 1, backgroundColor: 'rgba(249,200,216,0.05)', alignItems: 'center', justifyContent: 'center', position: 'relative' },
  pinImage: { width: '100%', height: '100%' },
  pinPlaceholder: { fontSize: 36 },
  editionBadge: { position: 'absolute', top: 4, left: 4, borderRadius: Theme.radius.pill, borderWidth: 0.5, paddingVertical: 1, paddingHorizontal: 5 },
  editionBadgeText: { fontSize: 7, fontWeight: '500' },
  pinInfo: { padding: Theme.spacing.sm, gap: 3 },
  pinName: { fontSize: Theme.fontSize.sm, fontWeight: '500', color: Colors.textPrimary, lineHeight: 16 },
  pinSeries: { fontSize: Theme.fontSize.xs, color: Colors.gold, opacity: 0.65 },
  pinOwner: { fontSize: Theme.fontSize.xs, color: Colors.textMuted },
  pinCondition: { fontSize: Theme.fontSize.xs, color: Colors.textMuted },
  pinActions: { flexDirection: 'row', gap: Theme.spacing.xs, marginTop: Theme.spacing.xs },
  tradeButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: Colors.goldFaint, borderWidth: 0.5, borderColor: Colors.goldBorder, borderRadius: Theme.radius.pill, paddingVertical: 5 },
  tradeButtonText: { fontSize: 9, color: Colors.gold, fontWeight: '500' },
  removeButton: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.pinkFaint, borderWidth: 0.5, borderColor: Colors.pinkBorder, alignItems: 'center', justifyContent: 'center' },
});