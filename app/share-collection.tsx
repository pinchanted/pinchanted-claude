// ============================================================
// PINCHANTED — Share Collection Screen
// app/share-collection.tsx
//
// Generates a pin collage image the user can share to
// Facebook groups or anywhere else via the native share sheet.
// ============================================================

import { useEffect, useState, useRef } from 'react';
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
  FlatList,
  Switch,
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { AntDesign } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';
import { useAuthStore } from '../src/stores/auth.store';
import { supabase, getPinImageUrl } from '../src/lib/supabase';
import { Colors } from '../src/constants/colors';
import { Theme } from '../src/constants/theme';

interface PinItem {
  id: string;
  name: string;
  series: string | null;
  imageUrl: string | null;
  condition: string | null;
  selected: boolean;
}

const DEFAULT_CAPTION = `🏰✨ Looking to trade! I have pins available on Pinchanted.

💬 DM me to discuss a trade or check out my full collection on the Pinchanted app.

#DisneyPins #PinTrading #DisneyPinTrading #Pinchanted`;

export default function ShareCollectionScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useAuthStore();
  const collageRef = useRef<ViewShot>(null);

  const [pins, setPins] = useState<PinItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [caption, setCaption] = useState(DEFAULT_CAPTION);
  const [showCondition, setShowCondition] = useState(true);
  const [showSeriesName, setShowSeriesName] = useState(true);
  const [step, setStep] = useState<'select' | 'preview' | 'caption'>('select');
  const [collageUri, setCollageUri] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.id) fetchPins();
  }, [profile?.id]);

  const fetchPins = async () => {
    const { data } = await supabase
      .from('collection_pins')
      .select(`
        id, my_image_path, condition,
        override_name, override_series_name,
        reference_pin:reference_pins(name, series_name),
        community_pin:community_pins(name, series_name)
      `)
      .eq('user_id', profile!.id)
      .eq('is_deleted', false)
      .eq('trade_status', 'available')
      .order('added_at', { ascending: false });

    if (data) {
      const mapped: PinItem[] = data.map((pin: any) => ({
        id: pin.id,
        name: pin.override_name ?? pin.reference_pin?.name ?? pin.community_pin?.name ?? 'Unknown pin',
        series: pin.override_series_name ?? pin.reference_pin?.series_name ?? pin.community_pin?.series_name ?? null,
        imageUrl: pin.my_image_path ? getPinImageUrl(pin.my_image_path) : null,
        condition: pin.condition,
        selected: true, // all selected by default
      }));
      setPins(mapped);
    }
    setIsLoading(false);
  };

  const togglePin = (id: string) => {
    setPins(prev => prev.map(p => p.id === id ? { ...p, selected: !p.selected } : p));
  };

  const toggleAll = () => {
    const allSelected = pins.every(p => p.selected);
    setPins(prev => prev.map(p => ({ ...p, selected: !allSelected })));
  };

  const selectedPins = pins.filter(p => p.selected);

  const generateCollage = async () => {
    if (selectedPins.length === 0) {
      Alert.alert('No pins selected', 'Please select at least one pin to include in your collage.');
      return;
    }
    setStep('preview');
  };

  const captureAndShare = async () => {
    if (!collageRef.current) return;
    setIsGenerating(true);
    try {
      const uri = await (collageRef.current as any).capture();
      setCollageUri(uri);

      // Request media library permission
      const { status } = await MediaLibrary.requestPermissionsAsync();

      if (status === 'granted') {
        await MediaLibrary.saveToLibraryAsync(uri);
      }

      // Open native share sheet
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: 'image/png',
          dialogTitle: 'Share your pin collection',
        });
      } else {
        Alert.alert('Saved!', 'Your collage has been saved to your photo library.');
      }
    } catch (error: any) {
      Alert.alert('Error', 'Could not generate collage. Please try again.');
      console.error('Collage error:', error);
    }
    setIsGenerating(false);
  };

  // ── Collage renderer ───────────────────────────────────────
  const COLS = selectedPins.length <= 4 ? 2 : selectedPins.length <= 9 ? 3 : 4;
  const CARD_SIZE = 160; // px per card in the collage

  const renderCollage = () => (
    <ViewShot
      ref={collageRef}
      options={{ format: 'png', quality: 1.0 }}
      style={[styles.collage, { width: COLS * CARD_SIZE + (COLS + 1) * 8 }]}
    >
      {/* Header */}
      <View style={styles.collageHeader}>
        <Text style={styles.collageHeaderTitle}>PINCHANTED</Text>
        <Text style={styles.collageHeaderSub}>
          @{profile?.username} · {selectedPins.length} pins available to trade
        </Text>
      </View>

      {/* Pin grid */}
      <View style={styles.collageGrid}>
        {selectedPins.map(pin => (
          <View key={pin.id} style={[styles.collageCard, { width: CARD_SIZE }]}>
            <View style={[styles.collageImageWrap, { height: CARD_SIZE }]}>
              {pin.imageUrl ? (
                <Image
                  source={{ uri: pin.imageUrl }}
                  style={styles.collageImage}
                  resizeMode="contain"
                />
              ) : (
                <View style={styles.collagePlaceholder}>
                  <Text style={styles.collagePlaceholderEmoji}>📌</Text>
                </View>
              )}
            </View>
            <View style={styles.collageInfo}>
              <Text style={styles.collagePinName} numberOfLines={2}>{pin.name}</Text>
              {showSeriesName && pin.series && (
                <Text style={styles.collagePinSeries} numberOfLines={1}>{pin.series}</Text>
              )}
              {showCondition && pin.condition && (
                <Text style={styles.collagePinCondition}>{pin.condition}</Text>
              )}
            </View>
          </View>
        ))}
      </View>

      {/* Footer */}
      <View style={styles.collageFooter}>
        <Text style={styles.collageFooterText}>
          Download Pinchanted to trade with me 📲
        </Text>
      </View>
    </ViewShot>
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
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>

        {/* Header */}
        <View style={[styles.headerBar, { paddingTop: Theme.spacing.md + insets.top }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => {
            if (step === 'select') router.back();
            else if (step === 'preview') setStep('select');
            else setStep('preview');
          }}>
            <AntDesign name="left" size={18} color={Colors.textPrimary} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Share Collection</Text>
            <Text style={styles.headerStep}>
              {step === 'select' ? 'Step 1 of 2 — Select pins' :
               step === 'preview' ? 'Step 2 of 2 — Preview & share' : 'Caption'}
            </Text>
          </View>
          <View style={{ width: 36 }} />
        </View>

        {/* ── Step 1: Select pins ─────────────────────────────── */}
        {step === 'select' && (
          <>
            <View style={styles.selectHeader}>
              <Text style={styles.selectCount}>
                {selectedPins.length} of {pins.length} pins selected
              </Text>
              <TouchableOpacity onPress={toggleAll}>
                <Text style={styles.selectToggleAll}>
                  {pins.every(p => p.selected) ? 'Deselect all' : 'Select all'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Options */}
            <View style={styles.optionsRow}>
              <View style={styles.optionItem}>
                <Text style={styles.optionLabel}>Show series name</Text>
                <Switch
                  value={showSeriesName}
                  onValueChange={setShowSeriesName}
                  trackColor={{ false: 'rgba(255,255,255,0.1)', true: 'rgba(245,197,24,0.3)' }}
                  thumbColor={showSeriesName ? Colors.gold : 'rgba(255,255,255,0.4)'}
                />
              </View>
              <View style={styles.optionItem}>
                <Text style={styles.optionLabel}>Show condition</Text>
                <Switch
                  value={showCondition}
                  onValueChange={setShowCondition}
                  trackColor={{ false: 'rgba(255,255,255,0.1)', true: 'rgba(245,197,24,0.3)' }}
                  thumbColor={showCondition ? Colors.gold : 'rgba(255,255,255,0.4)'}
                />
              </View>
            </View>

            {pins.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyEmoji}>📌</Text>
                <Text style={styles.emptyTitle}>No available pins</Text>
                <Text style={styles.emptySubtitle}>
                  Only pins with "Available" trade status will appear here.
                </Text>
              </View>
            ) : (
              <FlatList
                data={pins}
                keyExtractor={item => item.id}
                numColumns={3}
                columnWrapperStyle={styles.pinGridRow}
                contentContainerStyle={styles.pinGridContent}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[styles.pinSelectCard, item.selected && styles.pinSelectCardActive]}
                    onPress={() => togglePin(item.id)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.pinSelectCheck}>
                      {item.selected && (
                        <AntDesign name="check-circle" size={16} color={Colors.gold} />
                      )}
                    </View>
                    <View style={styles.pinSelectImageWrap}>
                      {item.imageUrl ? (
                        <Image source={{ uri: item.imageUrl }} style={styles.pinSelectImage} resizeMode="cover" />
                      ) : (
                        <Text style={styles.pinSelectEmoji}>📌</Text>
                      )}
                    </View>
                    <Text style={styles.pinSelectName} numberOfLines={2}>{item.name}</Text>
                  </TouchableOpacity>
                )}
              />
            )}

            <View style={[styles.footer, { paddingBottom: insets.bottom + Theme.spacing.md }]}>
              <TouchableOpacity
                style={[styles.primaryBtn, selectedPins.length === 0 && styles.primaryBtnDisabled]}
                onPress={generateCollage}
                disabled={selectedPins.length === 0}
              >
                <AntDesign name="picture" size={16} color="#fff" />
                <Text style={styles.primaryBtnText}>
                  Preview collage ({selectedPins.length} pins)
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* ── Step 2: Preview & share ─────────────────────────── */}
        {step === 'preview' && (
          <ScrollView contentContainerStyle={styles.previewContent} showsVerticalScrollIndicator={false}>
            <Text style={styles.previewHint}>
              This is how your collage will look. Scroll down to add a caption and share.
            </Text>

            {/* Collage preview — centered, scaled to fit screen */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.collageScroll}>
              <View style={{ transform: [{ scale: 0.75 }], transformOrigin: 'top left' }}>
                {renderCollage()}
              </View>
            </ScrollView>

            {/* Caption */}
            <View style={styles.captionSection}>
              <Text style={styles.captionLabel}>Post caption</Text>
              <TextInput
                style={styles.captionInput}
                value={caption}
                onChangeText={setCaption}
                multiline
                numberOfLines={6}
                placeholderTextColor={Colors.textPlaceholder}
              />
              <Text style={styles.captionHint}>
                Tip: Copy this caption and paste it with the image when posting to Facebook groups.
              </Text>
            </View>

            <TouchableOpacity
              style={styles.shareBtn}
              onPress={captureAndShare}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <AntDesign name="share-alt" size={18} color="#fff" />
                  <Text style={styles.shareBtnText}>Save image & share</Text>
                </>
              )}
            </TouchableOpacity>

            <Text style={styles.shareNote}>
              The collage image will be saved to your photo library and the share sheet will open so you can post it anywhere.
            </Text>
          </ScrollView>
        )}

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
  headerStep: { fontSize: Theme.fontSize.xs, color: Colors.textMuted },

  // Select step
  selectHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Theme.screenPadding, paddingBottom: Theme.spacing.sm },
  selectCount: { fontSize: Theme.fontSize.sm, color: Colors.textMuted },
  selectToggleAll: { fontSize: Theme.fontSize.sm, color: Colors.gold },
  optionsRow: { flexDirection: 'row', gap: Theme.spacing.md, paddingHorizontal: Theme.screenPadding, paddingBottom: Theme.spacing.md },
  optionItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 0.5, borderColor: 'rgba(245,197,24,0.15)', borderRadius: Theme.radius.md, padding: Theme.spacing.sm },
  optionLabel: { fontSize: Theme.fontSize.xs, color: Colors.textMuted },
  pinGridRow: { gap: Theme.spacing.sm },
  pinGridContent: { padding: Theme.screenPadding, paddingTop: 0, gap: Theme.spacing.sm, paddingBottom: 100 },
  pinSelectCard: { flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)', borderRadius: Theme.radius.md, overflow: 'hidden', position: 'relative' },
  pinSelectCardActive: { borderColor: Colors.goldBorder, backgroundColor: 'rgba(245,197,24,0.08)' },
  pinSelectCheck: { position: 'absolute', top: 4, right: 4, zIndex: 1 },
  pinSelectImageWrap: { aspectRatio: 1, backgroundColor: 'rgba(255,255,255,0.04)', alignItems: 'center', justifyContent: 'center' },
  pinSelectImage: { width: '100%', height: '100%' },
  pinSelectEmoji: { fontSize: 28 },
  pinSelectName: { fontSize: 9, color: Colors.textPrimary, padding: 4, lineHeight: 12 },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Theme.screenPadding, gap: Theme.spacing.md },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { fontSize: Theme.fontSize.xl, fontWeight: '500', color: Colors.textPrimary },
  emptySubtitle: { fontSize: Theme.fontSize.sm, color: Colors.textMuted, textAlign: 'center', lineHeight: 20 },
  footer: { padding: Theme.screenPadding, paddingTop: Theme.spacing.md, backgroundColor: 'rgba(15,29,110,0.95)', borderTopWidth: 0.5, borderTopColor: 'rgba(245,197,24,0.12)' },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Theme.spacing.sm, backgroundColor: Colors.crimson, borderRadius: Theme.radius.pill, paddingVertical: Theme.spacing.md, borderWidth: 1, borderColor: Colors.goldBorder },
  primaryBtnDisabled: { opacity: 0.4 },
  primaryBtnText: { fontSize: Theme.fontSize.md, fontWeight: '500', color: '#fff' },

  // Preview step
  previewContent: { padding: Theme.screenPadding, gap: Theme.spacing.xl, paddingBottom: 60 },
  previewHint: { fontSize: Theme.fontSize.sm, color: Colors.textMuted, textAlign: 'center', lineHeight: 18 },
  collageScroll: { marginHorizontal: -Theme.screenPadding },
  captionSection: { gap: Theme.spacing.sm },
  captionLabel: { fontSize: Theme.fontSize.sm, fontWeight: '500', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 },
  captionInput: { backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 0.5, borderColor: 'rgba(245,197,24,0.2)', borderRadius: Theme.radius.md, padding: Theme.spacing.md, color: Colors.textPrimary, fontSize: Theme.fontSize.sm, minHeight: 120, textAlignVertical: 'top', lineHeight: 20 },
  captionHint: { fontSize: Theme.fontSize.xs, color: Colors.textMuted, lineHeight: 16 },
  shareBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Theme.spacing.sm, backgroundColor: Colors.crimson, borderRadius: Theme.radius.pill, paddingVertical: Theme.spacing.md, borderWidth: 1, borderColor: Colors.goldBorder },
  shareBtnText: { fontSize: Theme.fontSize.md, fontWeight: '500', color: '#fff' },
  shareNote: { fontSize: Theme.fontSize.xs, color: Colors.textMuted, textAlign: 'center', lineHeight: 18 },

  // Collage styles — white background for clean look on Facebook
  collage: { backgroundColor: '#ffffff', padding: 8 },
  collageHeader: { backgroundColor: '#0b1554', padding: 16, marginBottom: 8, borderRadius: 8, alignItems: 'center', gap: 4 },
  collageHeaderTitle: { fontSize: 24, fontWeight: '700', color: '#f5c518', letterSpacing: 1 },
  collageHeaderSub: { fontSize: 12, color: 'rgba(255,255,255,0.7)' },
  collageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  collageCard: { backgroundColor: '#f8f8f8', borderRadius: 8, overflow: 'hidden', borderWidth: 0.5, borderColor: '#e0e0e0' },
  collageImageWrap: { backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center' },
  collageImage: { width: '100%', height: '100%' },
  collagePlaceholder: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f0f0f0' },
  collagePlaceholderEmoji: { fontSize: 48 },
  collageInfo: { padding: 8, gap: 2, backgroundColor: '#ffffff' },
  collagePinName: { fontSize: 11, fontWeight: '600', color: '#1a1a1a', lineHeight: 14 },
  collagePinSeries: { fontSize: 9, color: '#888', lineHeight: 12 },
  collagePinCondition: { fontSize: 9, color: '#0b1554', fontWeight: '500' },
  collageFooter: { backgroundColor: '#0b1554', padding: 12, marginTop: 8, borderRadius: 8, alignItems: 'center' },
  collageFooterText: { fontSize: 11, color: 'rgba(255,255,255,0.7)' },
});