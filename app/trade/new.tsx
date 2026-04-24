// ============================================================
// PINCHANTED — New Trade Screen
// app/trade/new.tsx
// ============================================================

import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { AntDesign } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../src/stores/auth.store';
import { supabase, createTrade, getPinImageUrl } from '../../src/lib/supabase';
import { sendNotification } from '../../src/lib/sendNotification';
import { Colors } from '../../src/constants/colors';
import { Theme } from '../../src/constants/theme';
import { CollectionPin, Profile } from '../../src/types/database.types';

interface PinWithImage extends CollectionPin {
  imageUrl?: string | null;
}

export default function NewTradeScreen() {
  const { seller_id, listing_pin_id } = useLocalSearchParams<{
    seller_id: string;
    listing_pin_id: string;
  }>();
  const insets = useSafeAreaInsets();
  const { profile } = useAuthStore();

  const [seller, setSeller] = useState<Profile | null>(null);
  const [sellerPins, setSellerPins] = useState<PinWithImage[]>([]);
  const [myPins, setMyPins] = useState<PinWithImage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [requestedPinIds, setRequestedPinIds] = useState<string[]>(
    listing_pin_id ? [listing_pin_id] : []
  );
  const [offeredPinIds, setOfferedPinIds] = useState<string[]>([]);

  useEffect(() => {
    if (seller_id && profile?.id) fetchData();
  }, [seller_id, profile?.id]);

  const fetchData = async () => {
    setIsLoading(true);

    const { data: sellerData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', seller_id)
      .single();

    if (sellerData) setSeller(sellerData as Profile);

    const { data: sellerPinsData } = await supabase
      .from('collection_pins')
      .select(`
        *,
        reference_pin:reference_pins(*),
        community_pin:community_pins(*)
      `)
      .eq('user_id', seller_id)
      .eq('trade_status', 'available')
      .eq('is_deleted', false);

    const { data: myPinsData } = await supabase
      .from('collection_pins')
      .select(`
        *,
        reference_pin:reference_pins(*),
        community_pin:community_pins(*)
      `)
      .eq('user_id', profile!.id)
      .in('trade_status', ['available', 'on_table'])
      .eq('is_deleted', false);

    const [sellerWithImages, myWithImages] = await Promise.all([
      loadImages(sellerPinsData as CollectionPin[] || []),
      loadImages(myPinsData as CollectionPin[] || []),
    ]);

    setSellerPins(sellerWithImages);
    setMyPins(myWithImages);
    setIsLoading(false);
  };

  const loadImages = async (pins: CollectionPin[]): Promise<PinWithImage[]> => {
    return Promise.all(
      pins.map(async (pin) => ({
        ...pin,
        imageUrl: pin.my_image_path
          ? getPinImageUrl(pin.my_image_path)
          : null,
      }))
    );
  };

  const toggleRequestedPin = (pinId: string) => {
    setRequestedPinIds(prev =>
      prev.includes(pinId)
        ? prev.filter(id => id !== pinId)
        : [...prev, pinId]
    );
  };

  const toggleOfferedPin = (pinId: string) => {
    setOfferedPinIds(prev =>
      prev.includes(pinId)
        ? prev.filter(id => id !== pinId)
        : [...prev, pinId]
    );
  };

  const handleSubmit = async () => {
    if (requestedPinIds.length === 0) {
      Alert.alert('Required', 'Please select at least one pin you want from the seller.');
      return;
    }
    if (offeredPinIds.length === 0) {
      Alert.alert('Required', 'Please select at least one pin to offer in return.');
      return;
    }

    Alert.alert(
      'Send trade offer?',
      `You are offering ${offeredPinIds.length} pin${offeredPinIds.length !== 1 ? 's' : ''} in exchange for ${requestedPinIds.length} pin${requestedPinIds.length !== 1 ? 's' : ''} from @${seller?.username}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send offer',
          onPress: async () => {
            setIsSubmitting(true);

            const { data, error } = await createTrade({
              initiator_id: profile!.id,
              recipient_id: seller_id,
              requested_pin_ids: requestedPinIds,
              offered_pin_ids: offeredPinIds,
            });

            if (error || !data) {
              setIsSubmitting(false);
              Alert.alert('Error', 'Could not send trade offer. Please try again.');
              return;
            }

            // Notify the seller they have a new trade offer
            await sendNotification('trade_offer_received', seller_id, {
              from_username: profile?.username,
              pin_count: offeredPinIds.length,
              trade_id: data.id,
            });

            setIsSubmitting(false);

            Alert.alert(
              'Offer sent! 🎉',
              `Your trade offer has been sent to @${seller?.username}. You'll be notified when they respond.`,
              [{
                text: 'View trade',
                onPress: () => router.replace(`/trade/${data.id}`),
              }]
            );
          },
        },
      ]
    );
  };

  const getPinName = (pin: CollectionPin) =>
    pin.reference_pin?.name || pin.community_pin?.name || 'Unknown pin';

  const getPinSeries = (pin: CollectionPin) =>
    pin.reference_pin?.series_name || pin.community_pin?.series_name || '';

  const getUserInitial = (p: Profile | null) =>
    p?.display_name?.[0]?.toUpperCase() || '?';

  const renderPin = (
    pin: PinWithImage,
    isSelected: boolean,
    onPress: () => void,
    selectedColor: string
  ) => (
    <TouchableOpacity
      key={pin.id}
      style={[
        styles.pinCard,
        isSelected && {
          borderColor: selectedColor,
          backgroundColor: `${selectedColor}15`,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[
        styles.selectionDot,
        isSelected && { backgroundColor: selectedColor, borderColor: selectedColor },
      ]}>
        {isSelected && <AntDesign name="check" size={10} color="#fff" />}
      </View>

      <View style={styles.pinImageWrap}>
        {pin.imageUrl ? (
          <Image source={{ uri: pin.imageUrl }} style={styles.pinImage} resizeMode="cover" />
        ) : (
          <Text style={styles.pinEmoji}>📌</Text>
        )}
      </View>

      <View style={styles.pinInfo}>
        <Text style={styles.pinName} numberOfLines={2}>{getPinName(pin)}</Text>
        {getPinSeries(pin) ? (
          <Text style={styles.pinSeries} numberOfLines={1}>{getPinSeries(pin)}</Text>
        ) : null}
        <Text style={styles.pinCondition}>{pin.condition || 'Mint'}</Text>
      </View>
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <LinearGradient colors={['#0f1d6e', '#0b1554', '#08103d']} style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.gold} />
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#0f1d6e', '#0b1554', '#08103d']} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>

        <View style={[styles.headerBar, { paddingTop: Theme.spacing.md + insets.top }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <AntDesign name="left" size={18} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>New Trade Offer</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Seller info */}
          <View style={styles.sellerCard}>
            <View style={styles.sellerAvatar}>
              <Text style={styles.sellerAvatarText}>{getUserInitial(seller)}</Text>
            </View>
            <View style={styles.sellerInfo}>
              <Text style={styles.sellerLabel}>Trading with</Text>
              <Text style={styles.sellerName}>@{seller?.username || 'unknown'}</Text>
              {(seller?.trade_rating ?? 0) > 0 && (
                <View style={styles.ratingRow}>
                  <AntDesign name="star" size={11} color={Colors.gold} />
                  <Text style={styles.ratingText}>
                    {seller!.trade_rating.toFixed(1)} · {seller!.trades_completed} trades
                  </Text>
                </View>
              )}
            </View>
            <Text style={styles.sellerCountry}>
              {seller?.country === 'US' ? '🇺🇸' : '🇨🇦'}
            </Text>
          </View>

          {/* Summary bar */}
          <View style={styles.summaryBar}>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryCount, { color: Colors.success }]}>
                {requestedPinIds.length}
              </Text>
              <Text style={styles.summaryLabel}>pin{requestedPinIds.length !== 1 ? 's' : ''} you want</Text>
            </View>
            <AntDesign name="swap" size={16} color={Colors.textMuted} />
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryCount, { color: Colors.error }]}>
                {offeredPinIds.length}
              </Text>
              <Text style={styles.summaryLabel}>pin{offeredPinIds.length !== 1 ? 's' : ''} you offer</Text>
            </View>
          </View>

          {/* Seller's pins */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionDot, { backgroundColor: Colors.success }]} />
              <Text style={styles.sectionTitle}>
                Pins from @{seller?.username} — tap to select what you want
              </Text>
            </View>
            {sellerPins.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>
                  This seller has no available pins to trade.
                </Text>
              </View>
            ) : (
              <View style={styles.pinGrid}>
                {sellerPins.map(pin =>
                  renderPin(
                    pin,
                    requestedPinIds.includes(pin.id),
                    () => toggleRequestedPin(pin.id),
                    Colors.success
                  )
                )}
              </View>
            )}
          </View>

          {/* My pins */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionDot, { backgroundColor: Colors.error }]} />
              <Text style={styles.sectionTitle}>
                Your pins — tap to select what you'll offer
              </Text>
            </View>
            {myPins.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>
                  You have no available pins to trade. Add pins to your collection first.
                </Text>
              </View>
            ) : (
              <View style={styles.pinGrid}>
                {myPins.map(pin =>
                  renderPin(
                    pin,
                    offeredPinIds.includes(pin.id),
                    () => toggleOfferedPin(pin.id),
                    Colors.error
                  )
                )}
              </View>
            )}
          </View>

          {/* Note */}
          <View style={styles.noteCard}>
            <AntDesign name="info-circle" size={13} color={Colors.textMuted} />
            <Text style={styles.noteText}>
              The seller will review your offer and can accept or decline. Pins you offer will be marked as "On the table" until the trade is resolved.
            </Text>
          </View>

        </ScrollView>

        {/* Submit button */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + Theme.spacing.md }]}>
          <TouchableOpacity
            style={[
              styles.submitBtn,
              (requestedPinIds.length === 0 || offeredPinIds.length === 0) && styles.submitBtnDisabled,
            ]}
            onPress={handleSubmit}
            disabled={isSubmitting || requestedPinIds.length === 0 || offeredPinIds.length === 0}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <AntDesign name="swap" size={16} color="#fff" />
                <Text style={styles.submitBtnText}>
                  Send trade offer
                  {requestedPinIds.length > 0 && offeredPinIds.length > 0
                    ? ` (${offeredPinIds.length} for ${requestedPinIds.length})`
                    : ''}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

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

  scrollView: { flex: 1 },
  scrollContent: {
    padding: Theme.screenPadding,
    paddingBottom: 20,
    gap: Theme.spacing.xl,
  },

  sellerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.md,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 0.5,
    borderColor: Colors.goldBorder,
    borderRadius: Theme.radius.md,
    padding: Theme.spacing.md,
  },
  sellerAvatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.royalBlue,
    borderWidth: 1.5, borderColor: Colors.goldBorder,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  sellerAvatarText: {
    fontSize: Theme.fontSize.lg,
    fontWeight: '500',
    color: Colors.gold,
  },
  sellerInfo: { flex: 1, gap: 2 },
  sellerLabel: { fontSize: Theme.fontSize.xs, color: Colors.textMuted },
  sellerName: { fontSize: Theme.fontSize.md, fontWeight: '500', color: Colors.textPrimary },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingText: { fontSize: Theme.fontSize.xs, color: Colors.gold },
  sellerCountry: { fontSize: 22, flexShrink: 0 },

  summaryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Theme.spacing.xl,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 0.5,
    borderColor: 'rgba(245,197,24,0.15)',
    borderRadius: Theme.radius.md,
    padding: Theme.spacing.md,
  },
  summaryItem: { alignItems: 'center', gap: 2 },
  summaryCount: {
    fontSize: Theme.fontSize.xxl,
    fontWeight: '500',
    lineHeight: 28,
  },
  summaryLabel: { fontSize: Theme.fontSize.xs, color: Colors.textMuted },

  section: { gap: Theme.spacing.md },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  sectionDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  sectionTitle: {
    fontSize: Theme.fontSize.sm,
    color: Colors.textMuted,
    flex: 1,
    lineHeight: 18,
  },

  pinGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Theme.spacing.sm,
  },
  pinCard: {
    width: '47%',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 0.5,
    borderColor: 'rgba(245,197,24,0.15)',
    borderRadius: Theme.radius.md,
    overflow: 'hidden',
    position: 'relative',
  },
  selectionDot: {
    position: 'absolute',
    top: 6, right: 6,
    width: 20, height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
    zIndex: 1,
  },
  pinImageWrap: {
    aspectRatio: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center', justifyContent: 'center',
  },
  pinImage: { width: '100%', height: '100%' },
  pinEmoji: { fontSize: 32 },
  pinInfo: { padding: Theme.spacing.sm, gap: 2 },
  pinName: {
    fontSize: Theme.fontSize.xs,
    fontWeight: '500',
    color: Colors.textPrimary,
    lineHeight: 15,
  },
  pinSeries: { fontSize: 9, color: Colors.gold, opacity: 0.7 },
  pinCondition: { fontSize: 9, color: Colors.textMuted },

  emptyState: {
    padding: Theme.spacing.lg,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: Theme.radius.md,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: Theme.fontSize.sm,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },

  noteCard: {
    flexDirection: 'row',
    gap: Theme.spacing.sm,
    padding: Theme.spacing.md,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: Theme.radius.md,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'flex-start',
  },
  noteText: {
    flex: 1,
    fontSize: Theme.fontSize.xs,
    color: Colors.textMuted,
    lineHeight: 18,
  },

  footer: {
    padding: Theme.screenPadding,
    paddingTop: Theme.spacing.md,
    backgroundColor: 'rgba(15,29,110,0.95)',
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(245,197,24,0.12)',
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Theme.spacing.sm,
    backgroundColor: Colors.crimson,
    borderRadius: Theme.radius.pill,
    paddingVertical: Theme.spacing.md,
    borderWidth: 1,
    borderColor: Colors.goldBorder,
  },
  submitBtnDisabled: { opacity: 0.45 },
  submitBtnText: {
    fontSize: Theme.fontSize.md,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
});