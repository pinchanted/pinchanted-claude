// ============================================================
// PINCHANTED — Counter Offer Screen
// app/trade/counter.tsx
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
import { supabase, getPinImageUrl } from '../../src/lib/supabase';
import { sendNotification } from '../../src/lib/sendNotification';
import { Colors } from '../../src/constants/colors';
import { Theme } from '../../src/constants/theme';
import { CollectionPin, Profile, Trade } from '../../src/types/database.types';

interface PinWithImage extends CollectionPin {
  imageUrl?: string | null;
}

export default function CounterOfferScreen() {
  const { trade_id } = useLocalSearchParams<{ trade_id: string }>();
  const insets = useSafeAreaInsets();
  const { profile } = useAuthStore();

  const [trade, setTrade] = useState<Trade | null>(null);
  const [otherUser, setOtherUser] = useState<Profile | null>(null);
  const [otherUserPins, setOtherUserPins] = useState<PinWithImage[]>([]);
  const [myPins, setMyPins] = useState<PinWithImage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // What I want from the other user
  const [requestedPinIds, setRequestedPinIds] = useState<string[]>([]);
  // What I'm offering to the other user
  const [offeredPinIds, setOfferedPinIds] = useState<string[]>([]);

  useEffect(() => {
    if (trade_id && profile?.id) fetchData();
  }, [trade_id, profile?.id]);

  const fetchData = async () => {
    setIsLoading(true);

    // Load the trade
    const { data: tradeData } = await supabase
      .from('trades')
      .select(`
        *,
        initiator:profiles!initiator_id(id, username, display_name, avatar_url, trade_rating, trades_completed, country),
        recipient:profiles!recipient_id(id, username, display_name, avatar_url, trade_rating, trades_completed, country)
      `)
      .eq('id', trade_id)
      .single();

    if (!tradeData) {
      Alert.alert('Error', 'Could not load trade.');
      router.back();
      return;
    }

    const t = tradeData as Trade;
    setTrade(t);

    const isInitiator = t.initiator_id === profile?.id;
    const other = isInitiator ? t.recipient : t.initiator;
    const otherId = isInitiator ? t.recipient_id : t.initiator_id;
    setOtherUser(other as Profile);

    // Pre-populate: what I currently want = what was requested from me
    // What I'm offering = what I originally offered
    if (isInitiator) {
      setRequestedPinIds(t.requested_pin_ids || []);
      setOfferedPinIds(t.offered_pin_ids || []);
    } else {
      // Recipient countering: flip perspective
      setRequestedPinIds(t.offered_pin_ids || []);   // I want what initiator offered
      setOfferedPinIds(t.requested_pin_ids || []);   // I offer what initiator wanted
    }

    // Load other user's available pins (plus currently traded pins so they can be kept)
    const { data: otherPinsData } = await supabase
      .from('collection_pins')
      .select(`*, reference_pin:reference_pins(*), community_pin:community_pins(*)`)
      .eq('user_id', otherId)
      .in('trade_status', ['available', 'on_table'])
      .eq('is_deleted', false);

    // Load my available pins
    const { data: myPinsData } = await supabase
      .from('collection_pins')
      .select(`*, reference_pin:reference_pins(*), community_pin:community_pins(*)`)
      .eq('user_id', profile!.id)
      .in('trade_status', ['available', 'on_table'])
      .eq('is_deleted', false);

    setOtherUserPins(loadImages(otherPinsData as CollectionPin[] || []));
    setMyPins(loadImages(myPinsData as CollectionPin[] || []));
    setIsLoading(false);
  };

  const loadImages = (pins: CollectionPin[]): PinWithImage[] => {
    return pins.map((pin) => ({
      ...pin,
      imageUrl: pin.my_image_path ? getPinImageUrl(pin.my_image_path) : null,
    }));
  };

  const toggleRequestedPin = (pinId: string) => {
    setRequestedPinIds(prev =>
      prev.includes(pinId) ? prev.filter(id => id !== pinId) : [...prev, pinId]
    );
  };

  const toggleOfferedPin = (pinId: string) => {
    setOfferedPinIds(prev =>
      prev.includes(pinId) ? prev.filter(id => id !== pinId) : [...prev, pinId]
    );
  };

  const handleSubmit = async () => {
    if (requestedPinIds.length === 0) {
      Alert.alert('Required', 'Please select at least one pin you want.');
      return;
    }
    if (offeredPinIds.length === 0) {
      Alert.alert('Required', 'Please select at least one pin to offer in return.');
      return;
    }

    Alert.alert(
      'Send counter offer?',
      `You are offering ${offeredPinIds.length} pin${offeredPinIds.length !== 1 ? 's' : ''} in exchange for ${requestedPinIds.length} pin${requestedPinIds.length !== 1 ? 's' : ''} from @${otherUser?.username}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send counter',
          onPress: async () => {
            setIsSubmitting(true);

            const isInitiator = trade?.initiator_id === profile?.id;
            const otherUserId = isInitiator ? trade!.recipient_id : trade!.initiator_id;

            // Update trade with new pin selections and set to in_progress
            const { error } = await supabase
              .from('trades')
              .update({
                status: 'in_progress',
                offered_pin_ids: isInitiator ? offeredPinIds : requestedPinIds,
                requested_pin_ids: isInitiator ? requestedPinIds : offeredPinIds,
                counter_count: (trade?.counter_count || 0) + 1,
                last_action_by: profile!.id,
                updated_at: new Date().toISOString(),
              })
              .eq('id', trade_id);

            if (error) {
              setIsSubmitting(false);
              Alert.alert('Error', 'Could not send counter offer. Please try again.');
              return;
            }

            // Update offered pins trade status
            // Release old offered pins back to available
            const oldOfferedPins = isInitiator ? trade!.offered_pin_ids : trade!.requested_pin_ids;
            const newOfferedPins = isInitiator ? offeredPinIds : requestedPinIds;

            // Pins no longer in the offer → back to available
            const removedPins = oldOfferedPins.filter(id => !newOfferedPins.includes(id));
            if (removedPins.length) {
              await supabase
                .from('collection_pins')
                .update({ trade_status: 'available', trade_id: null })
                .in('id', removedPins);
            }

            // New pins added to offer → mark on_table
            const addedPins = newOfferedPins.filter(id => !oldOfferedPins.includes(id));
            if (addedPins.length) {
              await supabase
                .from('collection_pins')
                .update({ trade_status: 'on_table', trade_id: trade_id })
                .in('id', addedPins);
            }

            await sendNotification('trade_offer_countered', otherUserId, {
              from_username: profile?.username,
              trade_id: trade_id,
            });

            setIsSubmitting(false);
            Alert.alert(
              'Counter offer sent! 🔄',
              `Your counter offer has been sent to @${otherUser?.username}. You'll be notified when they respond.`,
              [{ text: 'View trade', onPress: () => router.replace(`/trade/${trade_id}`) }]
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

  const renderPin = (
    pin: PinWithImage,
    isSelected: boolean,
    onPress: () => void,
    selectedColor: string
  ) => (
    <TouchableOpacity
      key={pin.id}
      style={[styles.pinCard, isSelected && { borderColor: selectedColor, backgroundColor: `${selectedColor}15` }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.selectionDot, isSelected && { backgroundColor: selectedColor, borderColor: selectedColor }]}>
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
        {getPinSeries(pin) ? <Text style={styles.pinSeries} numberOfLines={1}>{getPinSeries(pin)}</Text> : null}
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

  const counterCount = trade?.counter_count || 0;

  return (
    <LinearGradient colors={['#0f1d6e', '#0b1554', '#08103d']} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>

        <View style={[styles.headerBar, { paddingTop: Theme.spacing.md + insets.top }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <AntDesign name="left" size={18} color={Colors.textPrimary} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Counter Offer</Text>
            {counterCount > 0 && (
              <Text style={styles.headerSub}>Round {counterCount + 1} of negotiation</Text>
            )}
          </View>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

          {/* Other user card */}
          <View style={styles.sellerCard}>
            <View style={styles.sellerAvatar}>
              {otherUser?.avatar_url ? (
                <Image source={{ uri: otherUser.avatar_url }} style={styles.avatarImage} resizeMode="cover" />
              ) : (
                <Text style={styles.sellerAvatarText}>{otherUser?.display_name?.[0]?.toUpperCase() || '?'}</Text>
              )}
            </View>
            <View style={styles.sellerInfo}>
              <Text style={styles.sellerLabel}>Negotiating with</Text>
              <Text style={styles.sellerName}>@{otherUser?.username || 'unknown'}</Text>
              {(otherUser?.trade_rating ?? 0) > 0 && (
                <View style={styles.ratingRow}>
                  <AntDesign name="star" size={11} color={Colors.gold} />
                  <Text style={styles.ratingText}>
                    {otherUser!.trade_rating.toFixed(1)} · {otherUser!.trades_completed} trades
                  </Text>
                </View>
              )}
            </View>
            <Text style={styles.sellerCountry}>
              {otherUser?.country === 'US' ? '🇺🇸' : '🇨🇦'}
            </Text>
          </View>

          {/* Hint */}
          <View style={styles.hintCard}>
            <AntDesign name="edit" size={13} color={Colors.gold} />
            <Text style={styles.hintText}>
              Adjust the pin selection below to propose a new deal. Pre-selected pins are from the current offer.
            </Text>
          </View>

          {/* Summary */}
          <View style={styles.summaryBar}>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryCount, { color: Colors.success }]}>{requestedPinIds.length}</Text>
              <Text style={styles.summaryLabel}>you want</Text>
            </View>
            <AntDesign name="swap" size={16} color={Colors.textMuted} />
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryCount, { color: Colors.error }]}>{offeredPinIds.length}</Text>
              <Text style={styles.summaryLabel}>you offer</Text>
            </View>
          </View>

          {/* Their pins */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionDot, { backgroundColor: Colors.success }]} />
              <Text style={styles.sectionTitle}>
                Pins from @{otherUser?.username} — select what you want
              </Text>
            </View>
            {otherUserPins.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No available pins from this user.</Text>
              </View>
            ) : (
              <View style={styles.pinGrid}>
                {otherUserPins.map(pin => renderPin(pin, requestedPinIds.includes(pin.id), () => toggleRequestedPin(pin.id), Colors.success))}
              </View>
            )}
          </View>

          {/* My pins */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionDot, { backgroundColor: Colors.error }]} />
              <Text style={styles.sectionTitle}>
                Your pins — select what you'll offer
              </Text>
            </View>
            {myPins.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>You have no available pins to trade.</Text>
              </View>
            ) : (
              <View style={styles.pinGrid}>
                {myPins.map(pin => renderPin(pin, offeredPinIds.includes(pin.id), () => toggleOfferedPin(pin.id), Colors.error))}
              </View>
            )}
          </View>

        </ScrollView>

        {/* Submit */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + Theme.spacing.md }]}>
          <TouchableOpacity
            style={[styles.submitBtn, (requestedPinIds.length === 0 || offeredPinIds.length === 0) && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={isSubmitting || requestedPinIds.length === 0 || offeredPinIds.length === 0}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <AntDesign name="retweet" size={16} color="#fff" />
                <Text style={styles.submitBtnText}>
                  Send counter offer{requestedPinIds.length > 0 && offeredPinIds.length > 0 ? ` (${offeredPinIds.length} for ${requestedPinIds.length})` : ''}
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
  headerBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Theme.screenPadding, paddingBottom: Theme.spacing.md, backgroundColor: 'rgba(15,29,110,0.95)', borderBottomWidth: 0.5, borderBottomColor: 'rgba(245,197,24,0.12)' },
  backButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.07)', alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, alignItems: 'center', gap: 2 },
  headerTitle: { fontSize: Theme.fontSize.lg, fontWeight: '500', color: Colors.textPrimary },
  headerSub: { fontSize: Theme.fontSize.xs, color: Colors.gold },
  scrollView: { flex: 1 },
  scrollContent: { padding: Theme.screenPadding, paddingBottom: 20, gap: Theme.spacing.xl },
  sellerCard: { flexDirection: 'row', alignItems: 'center', gap: Theme.spacing.md, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 0.5, borderColor: Colors.goldBorder, borderRadius: Theme.radius.md, padding: Theme.spacing.md },
  sellerAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.royalBlue, borderWidth: 1.5, borderColor: Colors.goldBorder, alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' },
  avatarImage: { width: '100%', height: '100%', borderRadius: 22 },
  sellerAvatarText: { fontSize: Theme.fontSize.lg, fontWeight: '500', color: Colors.gold },
  sellerInfo: { flex: 1, gap: 2 },
  sellerLabel: { fontSize: Theme.fontSize.xs, color: Colors.textMuted },
  sellerName: { fontSize: Theme.fontSize.md, fontWeight: '500', color: Colors.textPrimary },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingText: { fontSize: Theme.fontSize.xs, color: Colors.gold },
  sellerCountry: { fontSize: 22, flexShrink: 0 },
  hintCard: { flexDirection: 'row', gap: Theme.spacing.sm, padding: Theme.spacing.md, backgroundColor: 'rgba(245,197,24,0.06)', borderRadius: Theme.radius.md, borderWidth: 0.5, borderColor: 'rgba(245,197,24,0.2)', alignItems: 'flex-start' },
  hintText: { flex: 1, fontSize: Theme.fontSize.xs, color: Colors.textMuted, lineHeight: 18 },
  summaryBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Theme.spacing.xl, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 0.5, borderColor: 'rgba(245,197,24,0.15)', borderRadius: Theme.radius.md, padding: Theme.spacing.md },
  summaryItem: { alignItems: 'center', gap: 2 },
  summaryCount: { fontSize: Theme.fontSize.xxl, fontWeight: '500', lineHeight: 28 },
  summaryLabel: { fontSize: Theme.fontSize.xs, color: Colors.textMuted },
  section: { gap: Theme.spacing.md },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: Theme.spacing.sm },
  sectionDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  sectionTitle: { fontSize: Theme.fontSize.sm, color: Colors.textMuted, flex: 1, lineHeight: 18 },
  pinGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Theme.spacing.sm },
  pinCard: { width: '47%', backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 0.5, borderColor: 'rgba(245,197,24,0.15)', borderRadius: Theme.radius.md, overflow: 'hidden', position: 'relative' },
  selectionDot: { position: 'absolute', top: 6, right: 6, width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.3)', backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  pinImageWrap: { aspectRatio: 1, backgroundColor: 'rgba(255,255,255,0.04)', alignItems: 'center', justifyContent: 'center' },
  pinImage: { width: '100%', height: '100%' },
  pinEmoji: { fontSize: 32 },
  pinInfo: { padding: Theme.spacing.sm, gap: 2 },
  pinName: { fontSize: Theme.fontSize.xs, fontWeight: '500', color: Colors.textPrimary, lineHeight: 15 },
  pinSeries: { fontSize: 9, color: Colors.gold, opacity: 0.7 },
  pinCondition: { fontSize: 9, color: Colors.textMuted },
  emptyState: { padding: Theme.spacing.lg, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)', borderRadius: Theme.radius.md, alignItems: 'center' },
  emptyText: { fontSize: Theme.fontSize.sm, color: Colors.textMuted, textAlign: 'center', lineHeight: 20 },
  footer: { padding: Theme.screenPadding, paddingTop: Theme.spacing.md, backgroundColor: 'rgba(15,29,110,0.95)', borderTopWidth: 0.5, borderTopColor: 'rgba(245,197,24,0.12)' },
  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Theme.spacing.sm, backgroundColor: Colors.crimson, borderRadius: Theme.radius.pill, paddingVertical: Theme.spacing.md, borderWidth: 1, borderColor: Colors.goldBorder },
  submitBtnDisabled: { opacity: 0.45 },
  submitBtnText: { fontSize: Theme.fontSize.md, fontWeight: '500', color: Colors.textPrimary },
});