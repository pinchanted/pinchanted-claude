// ============================================================
// PINCHANTED — Trade Detail Screen
// app/trade/[id].tsx
// ============================================================

import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  TextInput,
  Image,
  RefreshControl,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { AntDesign } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../src/stores/auth.store';
import { supabase, getPinImageUrl, updateTradeStatus } from '../../src/lib/supabase';
import { sendNotification } from '../../src/lib/sendNotification';
import { Colors } from '../../src/constants/colors';
import { Theme } from '../../src/constants/theme';
import {
  Trade,
  CollectionPin,
  Profile,
} from '../../src/types/database.types';

const STATUS_CONFIG: Record<string, {
  label: string; color: string; bg: string; border: string;
}> = {
  pending: { label: 'Pending', color: Colors.gold, bg: 'rgba(245,197,24,0.1)', border: 'rgba(245,197,24,0.35)' },
  in_progress: { label: 'In Progress', color: '#93c5fd', bg: 'rgba(100,160,255,0.1)', border: 'rgba(100,160,255,0.35)' },
  confirmed: { label: 'Confirmed', color: Colors.success, bg: 'rgba(93,202,122,0.1)', border: 'rgba(93,202,122,0.35)' },
  arrange_shipping: { label: 'Arrange Shipping', color: Colors.success, bg: 'rgba(93,202,122,0.1)', border: 'rgba(93,202,122,0.35)' },
  shipping: { label: 'Shipping', color: '#93c5fd', bg: 'rgba(100,160,255,0.1)', border: 'rgba(100,160,255,0.35)' },
  delivered: { label: 'Delivered', color: Colors.gold, bg: 'rgba(245,197,24,0.1)', border: 'rgba(245,197,24,0.35)' },
  completed: { label: 'Completed', color: Colors.success, bg: 'rgba(93,202,122,0.1)', border: 'rgba(93,202,122,0.35)' },
  declined: { label: 'Declined', color: Colors.textMuted, bg: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.12)' },
  expired: { label: 'Expired', color: Colors.textMuted, bg: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.12)' },
  disputed: { label: 'Disputed', color: Colors.error, bg: 'rgba(192,24,42,0.1)', border: 'rgba(192,24,42,0.35)' },
};

const SHIPPING_METHODS = [
  { value: 'standard', label: 'Standard' },
  { value: 'tracked', label: 'Tracked' },
  { value: 'tracked_insured', label: 'Tracked & Insured' },
];

interface PinWithImage extends CollectionPin {
  imageUrl?: string | null;
}

export default function TradeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { profile } = useAuthStore();

  const [trade, setTrade] = useState<Trade | null>(null);
  const [offeredPins, setOfferedPins] = useState<PinWithImage[]>([]);
  const [requestedPins, setRequestedPins] = useState<PinWithImage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const [showShippingForm, setShowShippingForm] = useState(false);
  const [carrier, setCarrier] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [shippingMethod, setShippingMethod] = useState('standard');

  useEffect(() => {
    if (id) fetchTrade();
  }, [id]);

  const fetchTrade = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('trades')
      .select(`
        *,
        initiator:profiles!initiator_id(
          id, username, display_name, avatar_url, trade_rating, trades_completed, country
        ),
        recipient:profiles!recipient_id(
          id, username, display_name, avatar_url, trade_rating, trades_completed, country
        )
      `)
      .eq('id', id)
      .single();

    if (error || !data) {
      Alert.alert('Error', 'Could not load trade details.');
      router.back();
      return;
    }

    setTrade(data as Trade);

    const [offeredData, requestedData] = await Promise.all([
      fetchPins(data.offered_pin_ids || []),
      fetchPins(data.requested_pin_ids || []),
    ]);

    setOfferedPins(offeredData);
    setRequestedPins(requestedData);
    setIsLoading(false);
  };

  const fetchPins = async (pinIds: string[]): Promise<PinWithImage[]> => {
    if (!pinIds.length) return [];

    const { data } = await supabase
      .from('collection_pins')
      .select(`
        *,
        reference_pin:reference_pins(*),
        community_pin:community_pins(*)
      `)
      .in('id', pinIds);

    if (!data) return [];

    const pinsWithImages = await Promise.all(
      (data as CollectionPin[]).map(async (pin) => {
        const imageUrl = pin.my_image_path
          ? await getPinImageUrl(pin.my_image_path)
          : null;
        return { ...pin, imageUrl };
      })
    );

    return pinsWithImages;
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchTrade();
    setRefreshing(false);
  }, [id]);

  // ── Trade actions ──────────────────────────────────────────

  const handleAccept = () => {
    Alert.alert(
      'Accept trade offer?',
      'By accepting, you agree to trade these pins. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Accept',
          onPress: async () => {
            setActionLoading(true);
            const { error } = await updateTradeStatus(id, 'confirmed');
            if (error) {
              Alert.alert('Error', 'Could not accept trade. Please try again.');
            } else {
              await sendNotification('trade_offer_accepted', trade!.initiator_id, {
                from_username: profile?.username,
                trade_id: id,
              });
              await fetchTrade();
            }
            setActionLoading(false);
          },
        },
      ]
    );
  };

  const handleDecline = () => {
    Alert.alert(
      'Decline trade offer?',
      'Are you sure you want to decline this trade?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            const { error } = await updateTradeStatus(id, 'declined');
            if (error) {
              Alert.alert('Error', 'Could not decline trade. Please try again.');
            } else {
              await sendNotification('trade_offer_declined', trade!.initiator_id, {
                from_username: profile?.username,
                trade_id: id,
              });
              await fetchTrade();
            }
            setActionLoading(false);
          },
        },
      ]
    );
  };

  const handleMarkShipped = async () => {
    if (shippingMethod !== 'standard' && (!carrier.trim() || !trackingNumber.trim())) {
      Alert.alert('Required', 'Please enter carrier and tracking number for tracked shipping.');
      return;
    }

    setActionLoading(true);
    const isInitiator = trade?.initiator_id === profile?.id;
    const otherUserId = isInitiator ? trade!.recipient_id : trade!.initiator_id;

    const updates = isInitiator
      ? {
          initiator_carrier: carrier.trim() || null,
          initiator_tracking_number: trackingNumber.trim() || null,
          initiator_shipping_method: shippingMethod,
          initiator_shipped_at: new Date().toISOString(),
        }
      : {
          recipient_carrier: carrier.trim() || null,
          recipient_tracking_number: trackingNumber.trim() || null,
          recipient_shipping_method: shippingMethod,
          recipient_shipped_at: new Date().toISOString(),
        };

    const { error } = await updateTradeStatus(id, 'shipping', updates);

    if (error) {
      Alert.alert('Error', 'Could not update shipping info. Please try again.');
    } else {
      await sendNotification('trade_package_shipped', otherUserId, {
        from_username: profile?.username,
        trade_id: id,
      });
      setShowShippingForm(false);
      setCarrier('');
      setTrackingNumber('');
      await fetchTrade();
    }
    setActionLoading(false);
  };

  const handleMarkReceived = () => {
    Alert.alert(
      'Mark as received?',
      'Confirm that you have received the pins from this trade.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm received',
          onPress: async () => {
            setActionLoading(true);
            const isInitiator = trade?.initiator_id === profile?.id;
            const otherUserId = isInitiator ? trade!.recipient_id : trade!.initiator_id;

            const updates = isInitiator
              ? { initiator_received_at: new Date().toISOString() }
              : { recipient_received_at: new Date().toISOString() };

            const bothReceived = isInitiator
              ? !!trade?.recipient_received_at
              : !!trade?.initiator_received_at;

            const newStatus = bothReceived ? 'completed' : 'delivered';
            const { error } = await updateTradeStatus(id, newStatus, updates);

            if (error) {
              Alert.alert('Error', 'Could not update trade. Please try again.');
              setActionLoading(false);
              return;
            }

            // ── Transfer the pins this user just received ────
            // Initiator receives the recipient's requested_pin_ids
            // Recipient receives the initiator's offered_pin_ids
            // This happens immediately when each user taps — independent
            // of what the other user has done.
            const pinsIReceived = isInitiator
              ? trade!.requested_pin_ids   // recipient sent these to me
              : trade!.offered_pin_ids;    // initiator sent these to me

            if (pinsIReceived?.length) {
              const { error: transferError } = await supabase
                .from('collection_pins')
                .update({
                  user_id: profile!.id,
                  trade_status: 'available',
                })
                .in('id', pinsIReceived);

              if (transferError) {
                console.error('Pin transfer error:', transferError.message);
              }
            }

            if (bothReceived) {
              await Promise.all([
                sendNotification('trade_completed', otherUserId, {
                  from_username: profile?.username,
                  trade_id: id,
                  pin_name: 'your pins',
                }),
                sendNotification('trade_completed', profile!.id, {
                  from_username: (trade!.initiator as any)?.username,
                  trade_id: id,
                  pin_name: 'your pins',
                }),
              ]);
              Alert.alert(
                'Trade complete! 🎉',
                "The pins have been added to your collection. This trade has been marked as completed. Don't forget to leave a rating!"
              );
            } else {
              await sendNotification('trade_package_received', otherUserId, {
                from_username: profile?.username,
                trade_id: id,
              });
              Alert.alert(
                'Pins received! ✅',
                'The pins have been added to your collection.'
              );
            }

            await fetchTrade();
            setActionLoading(false);
          },
        },
      ]
    );
  };

  const handleDispute = () => {
    Alert.alert(
      'Raise a dispute?',
      'Only raise a dispute if there is a genuine problem with this trade. An admin will review it.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Raise dispute',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            const isInitiator = trade?.initiator_id === profile?.id;
            const otherUserId = isInitiator ? trade!.recipient_id : trade!.initiator_id;

            const { error } = await updateTradeStatus(id, 'disputed');
            if (error) {
              Alert.alert('Error', 'Could not raise dispute. Please try again.');
            } else {
              await sendNotification('trade_disputed', otherUserId, {
                from_username: profile?.username,
                trade_id: id,
              });
              await fetchTrade();
            }
            setActionLoading(false);
          },
        },
      ]
    );
  };

  // ── Render helpers ─────────────────────────────────────────

  const getPinName = (pin: CollectionPin) =>
    pin.reference_pin?.name || pin.community_pin?.name || 'Unknown pin';

  const getPinSeries = (pin: CollectionPin) =>
    pin.reference_pin?.series_name || pin.community_pin?.series_name || '';

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

  const getExpiryText = () => {
    if (!trade?.expires_at) return null;
    if (!['pending', 'in_progress'].includes(trade.status)) return null;
    const expiry = new Date(trade.expires_at);
    const now = new Date();
    const diffMs = expiry.getTime() - now.getTime();
    const diffHours = Math.floor(diffMs / 3600000);
    if (diffHours < 0) return 'Expired';
    if (diffHours < 24) return `⏱ ${diffHours}hrs remaining`;
    return `⏱ ${Math.floor(diffHours / 24)}d remaining`;
  };

  const getUserInitial = (user: any) =>
    user?.display_name?.[0]?.toUpperCase() || '?';

  const renderPin = (pin: PinWithImage) => (
    <View key={pin.id} style={styles.pinCard}>
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
    </View>
  );

  const renderUserCard = (user: any, label: string, isYou: boolean) => (
    <View style={styles.userCard}>
      <View style={styles.userAvatar}>
        <Text style={styles.userAvatarText}>{getUserInitial(user)}</Text>
      </View>
      <View style={styles.userInfo}>
        <Text style={styles.userLabel}>{label}</Text>
        <Text style={styles.userName}>
          @{user?.username || 'unknown'} {isYou && <Text style={styles.youBadge}>(you)</Text>}
        </Text>
        {(user?.trade_rating ?? 0) > 0 && (
          <View style={styles.ratingRow}>
            <AntDesign name="star" size={10} color={Colors.gold} />
            <Text style={styles.ratingText}>
              {user.trade_rating.toFixed(1)} · {user.trades_completed} trades
            </Text>
          </View>
        )}
      </View>
      <View style={styles.countryBadge}>
        <Text style={styles.countryFlag}>
          {user?.country === 'US' ? '🇺🇸' : '🇨🇦'}
        </Text>
      </View>
    </View>
  );

  const renderShippingInfo = (
    carrierVal: string | null,
    tracking: string | null,
    method: string | null,
    shippedAt: string | null,
    receivedAt: string | null,
    label: string
  ) => {
    if (!shippedAt) return null;
    return (
      <View style={styles.shippingInfoCard}>
        <Text style={styles.shippingInfoLabel}>{label}</Text>
        {carrierVal && (
          <View style={styles.shippingInfoRow}>
            <Text style={styles.shippingInfoKey}>Carrier</Text>
            <Text style={styles.shippingInfoValue}>{carrierVal}</Text>
          </View>
        )}
        {tracking && (
          <View style={styles.shippingInfoRow}>
            <Text style={styles.shippingInfoKey}>Tracking</Text>
            <Text style={styles.shippingInfoValue}>{tracking}</Text>
          </View>
        )}
        {method && (
          <View style={styles.shippingInfoRow}>
            <Text style={styles.shippingInfoKey}>Method</Text>
            <Text style={styles.shippingInfoValue}>
              {SHIPPING_METHODS.find(m => m.value === method)?.label || method}
            </Text>
          </View>
        )}
        <View style={styles.shippingInfoRow}>
          <Text style={styles.shippingInfoKey}>Shipped</Text>
          <Text style={styles.shippingInfoValue}>{getTimeAgo(shippedAt)}</Text>
        </View>
        {receivedAt && (
          <View style={styles.shippingInfoRow}>
            <Text style={styles.shippingInfoKey}>Received</Text>
            <Text style={[styles.shippingInfoValue, { color: Colors.success }]}>
              ✓ Confirmed
            </Text>
          </View>
        )}
      </View>
    );
  };

  if (isLoading) {
    return (
      <LinearGradient colors={['#0f1d6e', '#0b1554', '#08103d']} style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.gold} />
        </View>
      </LinearGradient>
    );
  }

  if (!trade) return null;

  const isInitiator = trade.initiator_id === profile?.id;
  const isRecipient = trade.recipient_id === profile?.id;
  const otherUser = isInitiator ? trade.recipient : trade.initiator;
  const statusConfig = STATUS_CONFIG[trade.status] || STATUS_CONFIG.pending;
  const expiryText = getExpiryText();
  const myPins = isInitiator ? offeredPins : requestedPins;
  const theirPins = isInitiator ? requestedPins : offeredPins;
  const iHaveShipped = isInitiator
    ? !!trade.initiator_shipped_at
    : !!trade.recipient_shipped_at;
  const theyHaveShipped = isInitiator
    ? !!trade.recipient_shipped_at
    : !!trade.initiator_shipped_at;
  const iHaveReceived = isInitiator
    ? !!trade.initiator_received_at
    : !!trade.recipient_received_at;

  return (
    <LinearGradient colors={['#0f1d6e', '#0b1554', '#08103d']} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>

        <View style={[styles.headerBar, { paddingTop: Theme.spacing.md + insets.top }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <AntDesign name="left" size={18} color={Colors.textPrimary} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Trade</Text>
            <View style={[styles.statusPill, {
              backgroundColor: statusConfig.bg,
              borderColor: statusConfig.border,
            }]}>
              <Text style={[styles.statusPillText, { color: statusConfig.color }]}>
                {statusConfig.label}
              </Text>
            </View>
          </View>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.gold}
            />
          }
        >
          <View style={styles.metaRow}>
            <Text style={styles.metaText}>
              Started {getTimeAgo(trade.created_at)}
            </Text>
            {expiryText && (
              <Text style={styles.expiryText}>{expiryText}</Text>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Traders</Text>
            {renderUserCard(trade.initiator as Profile, 'Offer sent by', isInitiator)}
            {renderUserCard(trade.recipient as Profile, 'Offer sent to', isRecipient)}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Pin exchange</Text>

            <View style={styles.exchangeBlock}>
              <View style={styles.exchangeHeader}>
                <AntDesign name="arrow-down" size={14} color={Colors.success} />
                <Text style={styles.exchangeLabel}>
                  You receive from @{(otherUser as any)?.username || 'them'}
                </Text>
              </View>
              <View style={styles.pinList}>
                {theirPins.length > 0
                  ? theirPins.map(renderPin)
                  : <Text style={styles.noPins}>No pins specified</Text>
                }
              </View>
            </View>

            <View style={styles.swapDivider}>
              <View style={styles.swapLine} />
              <AntDesign name="swap" size={18} color={Colors.textMuted} />
              <View style={styles.swapLine} />
            </View>

            <View style={styles.exchangeBlock}>
              <View style={styles.exchangeHeader}>
                <AntDesign name="arrow-up" size={14} color={Colors.error} />
                <Text style={styles.exchangeLabel}>
                  You send to @{(otherUser as any)?.username || 'them'}
                </Text>
              </View>
              <View style={styles.pinList}>
                {myPins.length > 0
                  ? myPins.map(renderPin)
                  : <Text style={styles.noPins}>No pins specified</Text>
                }
              </View>
            </View>
          </View>

          {(trade.initiator_shipped_at || trade.recipient_shipped_at) && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Shipping</Text>
              {renderShippingInfo(
                trade.initiator_carrier,
                trade.initiator_tracking_number,
                trade.initiator_shipping_method,
                trade.initiator_shipped_at,
                trade.initiator_received_at,
                `From @${(trade.initiator as any)?.username || 'initiator'}`
              )}
              {renderShippingInfo(
                trade.recipient_carrier,
                trade.recipient_tracking_number,
                trade.recipient_shipping_method,
                trade.recipient_shipped_at,
                trade.recipient_received_at,
                `From @${(trade.recipient as any)?.username || 'recipient'}`
              )}
            </View>
          )}

          {showShippingForm && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Add shipping details</Text>
              <View style={styles.shippingForm}>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Shipping method</Text>
                  <View style={styles.segmentRow}>
                    {SHIPPING_METHODS.map(m => (
                      <TouchableOpacity
                        key={m.value}
                        style={[styles.segmentBtn, shippingMethod === m.value && styles.segmentBtnActive]}
                        onPress={() => setShippingMethod(m.value)}
                      >
                        <Text style={[styles.segmentBtnText, shippingMethod === m.value && styles.segmentBtnTextActive]}>
                          {m.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>
                    Carrier{shippingMethod !== 'standard' ? ' *' : ' (optional)'}
                  </Text>
                  <TextInput
                    style={styles.input}
                    value={carrier}
                    onChangeText={setCarrier}
                    placeholder="e.g. Canada Post, USPS, UPS"
                    placeholderTextColor={Colors.textPlaceholder}
                    autoCapitalize="words"
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>
                    Tracking number{shippingMethod !== 'standard' ? ' *' : ' (optional)'}
                  </Text>
                  <TextInput
                    style={styles.input}
                    value={trackingNumber}
                    onChangeText={setTrackingNumber}
                    placeholder="Enter tracking number"
                    placeholderTextColor={Colors.textPlaceholder}
                    autoCapitalize="characters"
                  />
                </View>

                <View style={styles.shippingFormActions}>
                  <TouchableOpacity
                    style={styles.cancelBtn}
                    onPress={() => setShowShippingForm(false)}
                  >
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, { flex: 1 }]}
                    onPress={handleMarkShipped}
                    disabled={actionLoading}
                  >
                    {actionLoading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.actionBtnText}>Confirm shipped</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {!showShippingForm && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Actions</Text>
              <View style={styles.actionsCard}>

                {trade.status === 'pending' && isRecipient && (
                  <>
                    <TouchableOpacity
                      style={styles.actionBtn}
                      onPress={handleAccept}
                      disabled={actionLoading}
                    >
                      {actionLoading ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <>
                          <AntDesign name="check" size={15} color="#fff" />
                          <Text style={styles.actionBtnText}>Accept offer</Text>
                        </>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.declineBtn}
                      onPress={handleDecline}
                      disabled={actionLoading}
                    >
                      <AntDesign name="close" size={15} color={Colors.error} />
                      <Text style={styles.declineBtnText}>Decline offer</Text>
                    </TouchableOpacity>
                  </>
                )}

                {trade.status === 'pending' && isInitiator && (
                  <View style={styles.waitingRow}>
                    <AntDesign name="clock-circle" size={16} color={Colors.textMuted} />
                    <Text style={styles.waitingText}>
                      Waiting for @{(otherUser as any)?.username} to respond
                    </Text>
                  </View>
                )}

                {/* Both users can mark shipped independently */}
                {(trade.status === 'confirmed' || trade.status === 'arrange_shipping' || trade.status === 'shipping') && (
                  !iHaveShipped ? (
                    <TouchableOpacity
                      style={styles.actionBtn}
                      onPress={() => setShowShippingForm(true)}
                    >
                      <AntDesign name="inbox" size={15} color="#fff" />
                      <Text style={styles.actionBtnText}>Mark as shipped</Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.waitingRow}>
                      <AntDesign name="check" size={16} color={Colors.success} />
                      <Text style={styles.waitingText}>
                        You've marked as shipped
                        {!theyHaveShipped ? ` · Waiting for @${(otherUser as any)?.username}` : ''}
                      </Text>
                    </View>
                  )
                )}

                {/* Mark received — available as soon as the other party has shipped */}
                {trade.status === 'shipping' && theyHaveShipped && !iHaveReceived && (
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={handleMarkReceived}
                    disabled={actionLoading}
                  >
                    {actionLoading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <AntDesign name="check-circle" size={15} color="#fff" />
                        <Text style={styles.actionBtnText}>Mark as received</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}

                {trade.status === 'shipping' && iHaveReceived && (
                  <View style={styles.waitingRow}>
                    <AntDesign name="check" size={16} color={Colors.success} />
                    <Text style={styles.waitingText}>
                      You've confirmed receipt — pins added to your collection
                      {!theyHaveShipped ? ` · Waiting for @${(otherUser as any)?.username} to ship` : ''}
                    </Text>
                  </View>
                )}

                {trade.status === 'delivered' && (
                  <View style={styles.waitingRow}>
                    <AntDesign name="check" size={16} color={Colors.success} />
                    <Text style={styles.waitingText}>
                      Both parties have confirmed receipt
                    </Text>
                  </View>
                )}

                {trade.status === 'completed' && (
                  <View style={styles.completedRow}>
                    <Text style={styles.completedEmoji}>🎉</Text>
                    <Text style={styles.completedText}>Trade completed!</Text>
                  </View>
                )}

                {(trade.status === 'declined' || trade.status === 'expired') && (
                  <View style={styles.waitingRow}>
                    <AntDesign name="close-circle" size={16} color={Colors.textMuted} />
                    <Text style={styles.waitingText}>
                      This trade was {trade.status}
                    </Text>
                  </View>
                )}

                {trade.status === 'disputed' && (
                  <View style={styles.waitingRow}>
                    <AntDesign name="exclamation-circle" size={16} color={Colors.error} />
                    <Text style={[styles.waitingText, { color: Colors.error }]}>
                      This trade is under dispute — an admin will review it
                    </Text>
                  </View>
                )}

                {['shipping', 'delivered'].includes(trade.status) && (
                  <>
                    <View style={styles.actionDivider} />
                    <TouchableOpacity
                      style={styles.disputeBtn}
                      onPress={handleDispute}
                      disabled={actionLoading}
                    >
                      <AntDesign name="warning" size={13} color={Colors.error} />
                      <Text style={styles.disputeBtnText}>Raise a dispute</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>
          )}

        </ScrollView>
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
  headerCenter: { flex: 1, alignItems: 'center', gap: Theme.spacing.xs },
  headerTitle: {
    fontSize: Theme.fontSize.lg,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  statusPill: {
    borderRadius: Theme.radius.pill,
    borderWidth: 0.5,
    paddingVertical: 3, paddingHorizontal: 10,
  },
  statusPillText: { fontSize: Theme.fontSize.xs, fontWeight: '500' },

  scrollView: { flex: 1 },
  scrollContent: {
    padding: Theme.screenPadding,
    paddingBottom: 60,
    gap: Theme.spacing.xl,
  },

  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaText: { fontSize: Theme.fontSize.xs, color: Colors.textMuted },
  expiryText: { fontSize: Theme.fontSize.xs, color: Colors.gold },

  section: { gap: Theme.spacing.md },
  sectionTitle: {
    fontSize: Theme.fontSize.sm,
    fontWeight: '500',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.md,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 0.5,
    borderColor: 'rgba(245,197,24,0.15)',
    borderRadius: Theme.radius.md,
    padding: Theme.spacing.md,
  },
  userAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.royalBlue,
    borderWidth: 1.5, borderColor: Colors.goldBorder,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  userAvatarText: {
    fontSize: Theme.fontSize.md,
    fontWeight: '500',
    color: Colors.gold,
  },
  userInfo: { flex: 1, gap: 2 },
  userLabel: { fontSize: Theme.fontSize.xs, color: Colors.textMuted },
  userName: { fontSize: Theme.fontSize.md, fontWeight: '500', color: Colors.textPrimary },
  youBadge: { color: Colors.gold, fontWeight: '400' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingText: { fontSize: Theme.fontSize.xs, color: Colors.gold },
  countryBadge: { flexShrink: 0 },
  countryFlag: { fontSize: 20 },

  exchangeBlock: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 0.5,
    borderColor: 'rgba(245,197,24,0.15)',
    borderRadius: Theme.radius.md,
    overflow: 'hidden',
  },
  exchangeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
    padding: Theme.spacing.md,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(245,197,24,0.1)',
  },
  exchangeLabel: {
    fontSize: Theme.fontSize.sm,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  pinList: { padding: Theme.spacing.sm, gap: Theme.spacing.sm },
  noPins: {
    fontSize: Theme.fontSize.sm,
    color: Colors.textMuted,
    padding: Theme.spacing.sm,
    textAlign: 'center',
  },
  swapDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.md,
  },
  swapLine: { flex: 1, height: 0.5, backgroundColor: 'rgba(255,255,255,0.1)' },

  pinCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.md,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: Theme.radius.sm,
    overflow: 'hidden',
  },
  pinImageWrap: {
    width: 52, height: 52,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  pinImage: { width: '100%', height: '100%' },
  pinEmoji: { fontSize: 24 },
  pinInfo: { flex: 1, gap: 2, paddingRight: Theme.spacing.sm },
  pinName: {
    fontSize: Theme.fontSize.sm,
    fontWeight: '500',
    color: Colors.textPrimary,
    lineHeight: 18,
  },
  pinSeries: { fontSize: Theme.fontSize.xs, color: Colors.gold, opacity: 0.7 },
  pinCondition: { fontSize: Theme.fontSize.xs, color: Colors.textMuted },

  shippingInfoCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 0.5,
    borderColor: 'rgba(245,197,24,0.15)',
    borderRadius: Theme.radius.md,
    padding: Theme.spacing.md,
    gap: Theme.spacing.sm,
  },
  shippingInfoLabel: {
    fontSize: Theme.fontSize.sm,
    fontWeight: '500',
    color: Colors.textPrimary,
    marginBottom: Theme.spacing.xs,
  },
  shippingInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  shippingInfoKey: { fontSize: Theme.fontSize.xs, color: Colors.textMuted },
  shippingInfoValue: { fontSize: Theme.fontSize.xs, color: Colors.textPrimary, fontWeight: '500' },

  shippingForm: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 0.5,
    borderColor: 'rgba(245,197,24,0.15)',
    borderRadius: Theme.radius.md,
    padding: Theme.spacing.md,
    gap: Theme.spacing.md,
  },
  fieldGroup: { gap: Theme.spacing.xs },
  fieldLabel: { fontSize: Theme.fontSize.sm, color: Colors.textMuted, fontWeight: '500' },
  input: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 0.5,
    borderColor: 'rgba(245,197,24,0.2)',
    borderRadius: Theme.radius.sm,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
    color: Colors.textPrimary,
    fontSize: Theme.fontSize.md,
  },
  segmentRow: { flexDirection: 'row', gap: Theme.spacing.xs },
  segmentBtn: {
    flex: 1,
    paddingVertical: Theme.spacing.sm,
    borderRadius: Theme.radius.sm,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
  },
  segmentBtnActive: { backgroundColor: Colors.goldFaint, borderColor: Colors.goldBorder },
  segmentBtnText: { fontSize: Theme.fontSize.xs, color: Colors.textMuted },
  segmentBtnTextActive: { color: Colors.gold, fontWeight: '500' },
  shippingFormActions: { flexDirection: 'row', gap: Theme.spacing.md },
  cancelBtn: {
    flex: 1, paddingVertical: Theme.spacing.md,
    borderRadius: Theme.radius.pill,
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
  },
  cancelBtnText: { fontSize: Theme.fontSize.md, color: Colors.textMuted },

  actionsCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 0.5,
    borderColor: 'rgba(245,197,24,0.15)',
    borderRadius: Theme.radius.md,
    padding: Theme.spacing.md,
    gap: Theme.spacing.md,
  },
  actionBtn: {
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
  actionBtnText: { fontSize: Theme.fontSize.md, fontWeight: '500', color: Colors.textPrimary },
  declineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Theme.spacing.sm,
    borderRadius: Theme.radius.pill,
    paddingVertical: Theme.spacing.md,
    borderWidth: 0.5,
    borderColor: Colors.errorBorder,
  },
  declineBtnText: { fontSize: Theme.fontSize.md, color: Colors.error },
  waitingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
    padding: Theme.spacing.sm,
  },
  waitingText: { fontSize: Theme.fontSize.sm, color: Colors.textMuted, flex: 1 },
  completedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Theme.spacing.sm,
    padding: Theme.spacing.sm,
  },
  completedEmoji: { fontSize: 24 },
  completedText: {
    fontSize: Theme.fontSize.md,
    fontWeight: '500',
    color: Colors.success,
  },
  actionDivider: { height: 0.5, backgroundColor: 'rgba(255,255,255,0.08)' },
  disputeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Theme.spacing.sm,
    paddingVertical: Theme.spacing.sm,
  },
  disputeBtnText: { fontSize: Theme.fontSize.sm, color: Colors.error },
});