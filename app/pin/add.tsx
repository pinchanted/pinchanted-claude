// ============================================================
// PINCHANTED — Add Pin Screen
// app/pin/add.tsx
// ============================================================

import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  ScrollView,
  TextInput,
  Image,
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { AntDesign } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '../../src/stores/auth.store';
import { useCollectionStore } from '../../src/stores/collection.store';
import { supabase, uploadPinImage } from '../../src/lib/supabase';
import { identifyPinWithClaude } from '../../src/lib/claude';
import { getCurrentUserId, setCurrentSession } from '../../src/lib/auth';
import { Colors } from '../../src/constants/colors';
import { Theme } from '../../src/constants/theme';

type Step = 'capture' | 'identifying' | 'results' | 'details' | 'success';

interface PinMatch {
  name: string;
  series_name: string | null;
  edition: string | null;
  origin: string | null;
  original_price: number | null;
  release_date: string | null;
  confidence: number;
  description: string;
}

export default function AddPinScreen() {
  const { profile } = useAuthStore();
  const { addPin } = useCollectionStore();
  const [step, setStep] = useState<Step>('capture');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [matches, setMatches] = useState<PinMatch[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<PinMatch | null>(null);
  const [isNotDisney, setIsNotDisney] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [purchasePrice, setPurchasePrice] = useState('');
  const [condition, setCondition] = useState('Mint');
  const [notes, setNotes] = useState('');

  const CONDITIONS = ['Mint', 'Near Mint', 'Good', 'Fair'];

  const pickImage = async (useCamera: boolean) => {
    try {
      let result;

      if (useCamera) {
        const permission =
          await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          Alert.alert(
            'Permission needed',
            'Please allow camera access to photograph pins.'
          );
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.8,
          base64: true,
          allowsEditing: true,
          aspect: [1, 1],
        });
      } else {
        const permission =
          await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          Alert.alert(
            'Permission needed',
            'Please allow photo library access.'
          );
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.8,
          base64: true,
          allowsEditing: true,
          aspect: [1, 1],
        });
      }

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setImageUri(asset.uri);
        setImageBase64(asset.base64 || null);
        await identifyPinFromImage(asset.base64 || '');
      }
    } catch (error) {
      Alert.alert('Error', 'Could not access camera or photo library.');
    }
  };

  const identifyPinFromImage = async (base64: string) => {
    setStep('identifying');
    setIsLoading(true);

    try {
      const result = await identifyPinWithClaude(base64);

      if (!result.is_disney_pin) {
        setIsNotDisney(true);
        setStep('results');
        setIsLoading(false);
        return;
      }

      setMatches(result.matches || []);
      setIsNotDisney(false);

      if (result.matches?.length > 0) {
        setSelectedMatch(result.matches[0]);
      }

      setStep('results');
    } catch (error) {
      console.error('Identification error:', error);
      Alert.alert(
        'Identification failed',
        'Could not identify the pin. Please try again with a clearer photo.',
        [{ text: 'Try again', onPress: () => setStep('capture') }]
      );
    }
    setIsLoading(false);
  };

  const handleSelectMatch = (match: PinMatch) => {
    setSelectedMatch(match);
    setStep('details');
  };

  const handleManualEntry = () => {
    setSelectedMatch({
      name: '',
      series_name: null,
      edition: null,
      origin: null,
      original_price: null,
      release_date: null,
      confidence: 0,
      description: 'Manually entered pin',
    });
    setStep('details');
  };

  const handleAddToCollection = async () => {
    setIsLoading(true);

    try {
      // Get user ID from memory session first, then Supabase
      let userId = getCurrentUserId() || profile?.id;

      if (!userId) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setCurrentSession(session);
          userId = session.user.id;
        }
      }

      if (!userId) {
        Alert.alert('Error', 'You must be logged in to add pins.');
        setIsLoading(false);
        return;
      }

      if (!selectedMatch?.name?.trim()) {
        Alert.alert('Missing name', 'Please enter a name for this pin.');
        setIsLoading(false);
        return;
      }

      // Upload image
      let storedImagePath: string | null = null;
      if (imageUri && imageBase64) {
        storedImagePath = await uploadPinImage(
          userId,
          imageUri,
          imageBase64
        );
      }

      // Create community pin
      const { data: communityPin, error: communityError } = await supabase
        .from('community_pins')
        .insert({
          name: selectedMatch.name,
          series_name: selectedMatch.series_name,
          edition: selectedMatch.edition,
          origin: selectedMatch.origin,
          original_price: selectedMatch.original_price,
          release_date: selectedMatch.release_date
            ? `${selectedMatch.release_date}-01-01`
            : null,
          contributed_by: userId,
          confirmation_count: 1,
          status: 'unverified',
          image_path: storedImagePath,
        })
        .select()
        .single();

      if (communityError) {
        Alert.alert('Error', communityError.message);
        setIsLoading(false);
        return;
      }

      // Add to collection
      const { data: collectionPin, error: collectionError } = await supabase
        .from('collection_pins')
        .insert({
          user_id: userId,
          community_pin_id: communityPin.id,
          my_purchase_price: purchasePrice
            ? parseFloat(purchasePrice) : null,
          condition,
          notes: notes || null,
          my_image_path: storedImagePath,
        })
        .select(`
          *,
          community_pin:community_pins(*)
        `)
        .single();

      if (collectionError) {
        Alert.alert('Error', collectionError.message);
        setIsLoading(false);
        return;
      }

      addPin(collectionPin as any);
      setStep('success');
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Unknown error');
    }

    setIsLoading(false);
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.85) return Colors.success;
    if (confidence >= 0.6) return Colors.gold;
    return Colors.error;
  };

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 0.85) return 'High confidence';
    if (confidence >= 0.6) return 'Medium confidence';
    return 'Low confidence';
  };

  // ── Step: Capture ──────────────────────────────────────────
  if (step === 'capture') {
    return (
      <LinearGradient
        colors={['#0f1d6e', '#0b1554', '#08103d']}
        style={styles.container}
      >
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
            >
              <AntDesign name="left" size={16} color={Colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Add a pin</Text>
          </View>

          <ScrollView
            contentContainerStyle={styles.captureContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.captureGuide}>
              <View style={styles.captureFrame}>
                <View style={styles.captureFrameCornerTL} />
                <View style={styles.captureFrameCornerTR} />
                <View style={styles.captureFrameCornerBL} />
                <View style={styles.captureFrameCornerBR} />
                <Text style={styles.captureFrameEmoji}>📌</Text>
                <Text style={styles.captureFrameHint}>Place pin here</Text>
              </View>
            </View>

            <View style={styles.captureTips}>
              <Text style={styles.captureTipsTitle}>
                Tips for best results
              </Text>
              <View style={styles.captureTip}>
                <Text style={styles.captureTipEmoji}>💡</Text>
                <Text style={styles.captureTipText}>
                  Good lighting makes a big difference
                </Text>
              </View>
              <View style={styles.captureTip}>
                <Text style={styles.captureTipEmoji}>📐</Text>
                <Text style={styles.captureTipText}>
                  Hold the camera steady and straight above the pin
                </Text>
              </View>
              <View style={styles.captureTip}>
                <Text style={styles.captureTipEmoji}>🎯</Text>
                <Text style={styles.captureTipText}>
                  Fill the frame with the pin for best accuracy
                </Text>
              </View>
            </View>

            <View style={styles.captureButtons}>
              <TouchableOpacity
                style={styles.cameraButton}
                onPress={() => pickImage(true)}
              >
                <AntDesign name="camera" size={24} color="#fff" />
                <Text style={styles.cameraButtonText}>Take photo</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.libraryButton}
                onPress={() => pickImage(false)}
              >
                <AntDesign name="picture" size={20} color={Colors.gold} />
                <Text style={styles.libraryButtonText}>
                  Choose from library
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.manualButton}
                onPress={handleManualEntry}
              >
                <Text style={styles.manualButtonText}>
                  Enter details manually
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // ── Step: Identifying ──────────────────────────────────────
  if (step === 'identifying') {
    return (
      <LinearGradient
        colors={['#0f1d6e', '#0b1554', '#08103d']}
        style={styles.container}
      >
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.identifyingContainer}>
            {imageUri && (
              <Image
                source={{ uri: imageUri }}
                style={styles.identifyingImage}
              />
            )}
            <View style={styles.identifyingCard}>
              <ActivityIndicator size="large" color={Colors.gold} />
              <Text style={styles.identifyingTitle}>
                Identifying your pin...
              </Text>
              <Text style={styles.identifyingSubtitle}>
                Our AI is analysing your pin against thousands of
                Disney pins in our database
              </Text>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // ── Step: Results ──────────────────────────────────────────
  if (step === 'results') {
    return (
      <LinearGradient
        colors={['#0f1d6e', '#0b1554', '#08103d']}
        style={styles.container}
      >
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => setStep('capture')}
            >
              <AntDesign name="left" size={16} color={Colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>
              {isNotDisney
                ? 'Not a Disney pin?'
                : 'We found some matches!'}
            </Text>
          </View>

          <ScrollView
            contentContainerStyle={styles.resultsContent}
            showsVerticalScrollIndicator={false}
          >
            {imageUri && (
              <Image
                source={{ uri: imageUri }}
                style={styles.resultImage}
              />
            )}

            {isNotDisney ? (
              <View style={styles.notDisneyCard}>
                <Text style={styles.notDisneyEmoji}>🤔</Text>
                <Text style={styles.notDisneyTitle}>
                  This doesn't look like a Disney pin
                </Text>
                <Text style={styles.notDisneySubtitle}>
                  Try taking a clearer photo, or enter the
                  pin details manually.
                </Text>
                <TouchableOpacity
                  style={styles.retakeButton}
                  onPress={() => setStep('capture')}
                >
                  <Text style={styles.retakeButtonText}>Try again</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.manualEntryLink}
                  onPress={handleManualEntry}
                >
                  <Text style={styles.manualEntryLinkText}>
                    Enter manually instead
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <Text style={styles.resultsHint}>
                  Select the best match for your pin
                </Text>

                {matches.map((match, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.matchCard}
                    onPress={() => handleSelectMatch(match)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.matchHeader}>
                      <View style={styles.matchRank}>
                        <Text style={styles.matchRankText}>
                          #{index + 1}
                        </Text>
                      </View>
                      <View style={styles.matchTitleArea}>
                        <Text
                          style={styles.matchName}
                          numberOfLines={2}
                        >
                          {match.name}
                        </Text>
                        {match.series_name && (
                          <Text style={styles.matchSeries}>
                            {match.series_name}
                          </Text>
                        )}
                      </View>
                      <View style={[styles.confidencePill, {
                        backgroundColor:
                          `${getConfidenceColor(match.confidence)}20`,
                        borderColor:
                          `${getConfidenceColor(match.confidence)}50`,
                      }]}>
                        <Text style={[styles.confidenceText, {
                          color: getConfidenceColor(match.confidence),
                        }]}>
                          {Math.round(match.confidence * 100)}%
                        </Text>
                      </View>
                    </View>

                    <Text
                      style={styles.matchDescription}
                      numberOfLines={2}
                    >
                      {match.description}
                    </Text>

                    <View style={styles.matchMeta}>
                      {match.edition && (
                        <View style={styles.matchMetaPill}>
                          <Text style={styles.matchMetaText}>
                            {match.edition}
                          </Text>
                        </View>
                      )}
                      {match.origin && (
                        <View style={styles.matchMetaPill}>
                          <Text style={styles.matchMetaText}>
                            {match.origin}
                          </Text>
                        </View>
                      )}
                      {match.original_price && (
                        <View style={styles.matchMetaPill}>
                          <Text style={styles.matchMetaText}>
                            ${match.original_price}
                          </Text>
                        </View>
                      )}
                    </View>

                    <View style={styles.matchConfidenceBar}>
                      <Text style={styles.matchConfidenceLabel}>
                        {getConfidenceLabel(match.confidence)}
                      </Text>
                      <View style={styles.matchConfidenceTrack}>
                        <View style={[
                          styles.matchConfidenceFill,
                          {
                            width: `${match.confidence * 100}%` as any,
                            backgroundColor:
                              getConfidenceColor(match.confidence),
                          },
                        ]} />
                      </View>
                    </View>

                    <View style={styles.selectButton}>
                      <Text style={styles.selectButtonText}>
                        This is my pin →
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}

                <TouchableOpacity
                  style={styles.noneMatchButton}
                  onPress={handleManualEntry}
                >
                  <Text style={styles.noneMatchButtonText}>
                    None of these match — enter manually
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // ── Step: Details ──────────────────────────────────────────
  if (step === 'details') {
    return (
      <LinearGradient
        colors={['#0f1d6e', '#0b1554', '#08103d']}
        style={styles.container}
      >
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => setStep('results')}
            >
              <AntDesign name="left" size={16} color={Colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Pin details</Text>
          </View>

          <ScrollView
            contentContainerStyle={styles.detailsContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {imageUri && (
              <Image
                source={{ uri: imageUri }}
                style={styles.detailsImage}
              />
            )}

            {/* Reference data — locked */}
            {selectedMatch && selectedMatch.confidence > 0 && (
              <View style={styles.referenceCard}>
                <View style={styles.referenceCardHeader}>
                  <Text style={styles.referenceCardTitle}>
                    Pin information
                  </Text>
                  <View style={styles.lockedBadge}>
                    <AntDesign
                      name="lock"
                      size={10}
                      color={Colors.textMuted}
                    />
                    <Text style={styles.lockedBadgeText}>
                      From database
                    </Text>
                  </View>
                </View>

                <View style={styles.referenceField}>
                  <Text style={styles.referenceLabel}>Name</Text>
                  <Text style={styles.referenceValue}>
                    {selectedMatch.name}
                  </Text>
                </View>
                {selectedMatch.series_name && (
                  <View style={styles.referenceField}>
                    <Text style={styles.referenceLabel}>Series</Text>
                    <Text style={styles.referenceValue}>
                      {selectedMatch.series_name}
                    </Text>
                  </View>
                )}
                {selectedMatch.edition && (
                  <View style={styles.referenceField}>
                    <Text style={styles.referenceLabel}>Edition</Text>
                    <Text style={styles.referenceValue}>
                      {selectedMatch.edition}
                    </Text>
                  </View>
                )}
                {selectedMatch.origin && (
                  <View style={styles.referenceField}>
                    <Text style={styles.referenceLabel}>Origin</Text>
                    <Text style={styles.referenceValue}>
                      {selectedMatch.origin}
                    </Text>
                  </View>
                )}
                {selectedMatch.original_price && (
                  <View style={styles.referenceField}>
                    <Text style={styles.referenceLabel}>
                      Original price
                    </Text>
                    <Text style={styles.referenceValue}>
                      ${selectedMatch.original_price}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* Manual name entry */}
            {selectedMatch && selectedMatch.confidence === 0 && (
              <View style={styles.userCard}>
                <Text style={styles.userCardTitle}>Pin name</Text>
                <TextInput
                  style={styles.userInput}
                  value={selectedMatch.name}
                  onChangeText={(text) =>
                    setSelectedMatch({ ...selectedMatch, name: text })
                  }
                  placeholder="Enter pin name"
                  placeholderTextColor={Colors.textPlaceholder}
                  autoCapitalize="words"
                />
              </View>
            )}

            {/* User editable fields */}
            <View style={styles.userCard}>
              <Text style={styles.userCardTitle}>Your details</Text>

              <View style={styles.userField}>
                <Text style={styles.userFieldLabel}>
                  Purchase price (optional)
                </Text>
                <View style={styles.priceInput}>
                  <Text style={styles.priceCurrency}>$</Text>
                  <TextInput
                    style={styles.priceTextInput}
                    value={purchasePrice}
                    onChangeText={setPurchasePrice}
                    placeholder="0.00"
                    placeholderTextColor={Colors.textPlaceholder}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>

              <View style={styles.userField}>
                <Text style={styles.userFieldLabel}>Condition</Text>
                <View style={styles.conditionOptions}>
                  {CONDITIONS.map(c => (
                    <TouchableOpacity
                      key={c}
                      style={[
                        styles.conditionOption,
                        condition === c &&
                          styles.conditionOptionSelected,
                      ]}
                      onPress={() => setCondition(c)}
                    >
                      <Text style={[
                        styles.conditionOptionText,
                        condition === c &&
                          styles.conditionOptionTextSelected,
                      ]}>
                        {c}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.userField}>
                <Text style={styles.userFieldLabel}>
                  Notes (optional)
                </Text>
                <TextInput
                  style={[styles.userInput, styles.notesInput]}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Any notes about this pin..."
                  placeholderTextColor={Colors.textPlaceholder}
                  multiline
                  numberOfLines={3}
                />
              </View>
            </View>

            <TouchableOpacity
              style={styles.addButton}
              onPress={handleAddToCollection}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.addButtonText}>
                  Add to my collection ✨
                </Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // ── Step: Success ──────────────────────────────────────────
  return (
    <LinearGradient
      colors={['#0f1d6e', '#0b1554', '#08103d']}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.successContainer}>
          <Text style={styles.successEmoji}>🎉</Text>
          <Text style={styles.successTitle}>Pin added!</Text>
          <Text style={styles.successSubtitle}>
            {selectedMatch?.name} has been added to your collection
          </Text>

          {imageUri && (
            <Image
              source={{ uri: imageUri }}
              style={styles.successImage}
            />
          )}

          <View style={styles.successButtons}>
            <TouchableOpacity
              style={styles.addAnotherButton}
              onPress={() => {
                setStep('capture');
                setImageUri(null);
                setImageBase64(null);
                setMatches([]);
                setSelectedMatch(null);
                setPurchasePrice('');
                setCondition('Mint');
                setNotes('');
              }}
            >
              <Text style={styles.addAnotherButtonText}>
                Add another pin
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.viewCollectionButton}
              onPress={() => router.replace('/(tabs)/collection')}
            >
              <Text style={styles.viewCollectionButtonText}>
                View my collection
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.md,
    padding: Theme.screenPadding,
    paddingTop: Theme.spacing.xl,
    backgroundColor: 'rgba(15,29,110,0.95)',
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(245,197,24,0.12)',
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  headerTitle: {
    fontSize: Theme.fontSize.xl,
    fontWeight: '500',
    color: Colors.textPrimary,
  },

  captureContent: {
    padding: Theme.screenPadding,
    gap: Theme.spacing.xl,
    paddingBottom: 40,
  },
  captureGuide: {
    alignItems: 'center',
    paddingVertical: Theme.spacing.xl,
  },
  captureFrame: {
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  captureFrameCornerTL: {
    position: 'absolute',
    top: 0, left: 0,
    width: 30, height: 30,
    borderTopWidth: 2, borderLeftWidth: 2,
    borderColor: Colors.gold,
    borderTopLeftRadius: 4,
  },
  captureFrameCornerTR: {
    position: 'absolute',
    top: 0, right: 0,
    width: 30, height: 30,
    borderTopWidth: 2, borderRightWidth: 2,
    borderColor: Colors.gold,
    borderTopRightRadius: 4,
  },
  captureFrameCornerBL: {
    position: 'absolute',
    bottom: 0, left: 0,
    width: 30, height: 30,
    borderBottomWidth: 2, borderLeftWidth: 2,
    borderColor: Colors.gold,
    borderBottomLeftRadius: 4,
  },
  captureFrameCornerBR: {
    position: 'absolute',
    bottom: 0, right: 0,
    width: 30, height: 30,
    borderBottomWidth: 2, borderRightWidth: 2,
    borderColor: Colors.gold,
    borderBottomRightRadius: 4,
  },
  captureFrameEmoji: { fontSize: 64 },
  captureFrameHint: {
    fontSize: Theme.fontSize.sm,
    color: Colors.textMuted,
    marginTop: Theme.spacing.sm,
  },

  captureTips: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 0.5,
    borderColor: 'rgba(245,197,24,0.15)',
    borderRadius: Theme.radius.lg,
    padding: Theme.spacing.lg,
    gap: Theme.spacing.md,
  },
  captureTipsTitle: {
    fontSize: Theme.fontSize.md,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  captureTip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Theme.spacing.md,
  },
  captureTipEmoji: { fontSize: 18, flexShrink: 0 },
  captureTipText: {
    fontSize: Theme.fontSize.sm,
    color: Colors.textMuted,
    flex: 1,
    lineHeight: 20,
  },

  captureButtons: { gap: Theme.spacing.md },
  cameraButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Theme.spacing.md,
    backgroundColor: Colors.crimson,
    borderRadius: Theme.radius.pill,
    padding: Theme.spacing.md,
    borderWidth: 1,
    borderColor: Colors.goldBorder,
  },
  cameraButtonText: {
    fontSize: Theme.fontSize.md,
    fontWeight: '500',
    color: '#fff',
  },
  libraryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Theme.spacing.md,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: Theme.radius.pill,
    padding: Theme.spacing.md,
    borderWidth: 0.5,
    borderColor: Colors.goldBorder,
  },
  libraryButtonText: {
    fontSize: Theme.fontSize.md,
    color: Colors.gold,
  },
  manualButton: {
    alignItems: 'center',
    padding: Theme.spacing.sm,
  },
  manualButtonText: {
    fontSize: Theme.fontSize.sm,
    color: Colors.textMuted,
  },

  identifyingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Theme.screenPadding,
    gap: Theme.spacing.xl,
  },
  identifyingImage: {
    width: 160,
    height: 160,
    borderRadius: Theme.radius.lg,
    borderWidth: 2,
    borderColor: Colors.goldBorder,
    opacity: 0.7,
  },
  identifyingCard: {
    alignItems: 'center',
    gap: Theme.spacing.md,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 0.5,
    borderColor: Colors.goldBorder,
    borderRadius: Theme.radius.xl,
    padding: Theme.spacing.xl,
    width: '100%',
  },
  identifyingTitle: {
    fontSize: Theme.fontSize.xl,
    fontWeight: '500',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  identifyingSubtitle: {
    fontSize: Theme.fontSize.sm,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },

  resultsContent: {
    padding: Theme.screenPadding,
    gap: Theme.spacing.lg,
    paddingBottom: 40,
  },
  resultImage: {
    width: '100%',
    height: 200,
    borderRadius: Theme.radius.lg,
    borderWidth: 1,
    borderColor: Colors.goldBorder,
  },
  resultsHint: {
    fontSize: Theme.fontSize.sm,
    color: Colors.textMuted,
    textAlign: 'center',
  },

  notDisneyCard: {
    alignItems: 'center',
    gap: Theme.spacing.md,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: Theme.radius.xl,
    padding: Theme.spacing.xl,
  },
  notDisneyEmoji: { fontSize: 48 },
  notDisneyTitle: {
    fontSize: Theme.fontSize.xl,
    fontWeight: '500',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  notDisneySubtitle: {
    fontSize: Theme.fontSize.sm,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  retakeButton: {
    backgroundColor: Colors.crimson,
    borderRadius: Theme.radius.pill,
    paddingVertical: Theme.spacing.sm,
    paddingHorizontal: Theme.spacing.xl,
    borderWidth: 1,
    borderColor: Colors.goldBorder,
    marginTop: Theme.spacing.sm,
  },
  retakeButtonText: {
    color: '#fff',
    fontSize: Theme.fontSize.md,
    fontWeight: '500',
  },
  manualEntryLink: { padding: Theme.spacing.sm },
  manualEntryLinkText: {
    color: Colors.gold,
    fontSize: Theme.fontSize.sm,
  },

  matchCard: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 0.5,
    borderColor: 'rgba(245,197,24,0.2)',
    borderRadius: Theme.radius.lg,
    padding: Theme.spacing.lg,
    gap: Theme.spacing.md,
  },
  matchHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Theme.spacing.sm,
  },
  matchRank: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.goldFaint,
    borderWidth: 0.5,
    borderColor: Colors.goldBorder,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  matchRankText: {
    fontSize: 10,
    color: Colors.gold,
    fontWeight: '500',
  },
  matchTitleArea: { flex: 1, gap: 2 },
  matchName: {
    fontSize: Theme.fontSize.md,
    fontWeight: '500',
    color: Colors.textPrimary,
    lineHeight: 20,
  },
  matchSeries: {
    fontSize: Theme.fontSize.xs,
    color: Colors.gold,
    opacity: 0.7,
  },
  confidencePill: {
    borderRadius: Theme.radius.pill,
    borderWidth: 0.5,
    paddingVertical: 3,
    paddingHorizontal: 8,
    flexShrink: 0,
  },
  confidenceText: {
    fontSize: 10,
    fontWeight: '500',
  },
  matchDescription: {
    fontSize: Theme.fontSize.sm,
    color: Colors.textMuted,
    lineHeight: 18,
  },
  matchMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Theme.spacing.xs,
  },
  matchMetaPill: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: Theme.radius.pill,
    paddingVertical: 3,
    paddingHorizontal: 9,
  },
  matchMetaText: {
    fontSize: 10,
    color: Colors.textSecondary,
  },
  matchConfidenceBar: { gap: 6 },
  matchConfidenceLabel: {
    fontSize: Theme.fontSize.xs,
    color: Colors.textMuted,
  },
  matchConfidenceTrack: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  matchConfidenceFill: {
    height: '100%',
    borderRadius: 2,
  },
  selectButton: {
    backgroundColor: Colors.crimson,
    borderRadius: Theme.radius.pill,
    padding: Theme.spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.goldBorder,
  },
  selectButtonText: {
    color: '#fff',
    fontSize: Theme.fontSize.sm,
    fontWeight: '500',
  },
  noneMatchButton: {
    alignItems: 'center',
    padding: Theme.spacing.md,
  },
  noneMatchButtonText: {
    color: Colors.gold,
    fontSize: Theme.fontSize.sm,
  },

  detailsContent: {
    padding: Theme.screenPadding,
    gap: Theme.spacing.lg,
    paddingBottom: 40,
  },
  detailsImage: {
    width: '100%',
    height: 180,
    borderRadius: Theme.radius.lg,
    borderWidth: 1,
    borderColor: Colors.goldBorder,
  },

  referenceCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 0.5,
    borderColor: 'rgba(245,197,24,0.15)',
    borderRadius: Theme.radius.lg,
    padding: Theme.spacing.lg,
    gap: Theme.spacing.md,
  },
  referenceCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  referenceCardTitle: {
    fontSize: Theme.fontSize.md,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  lockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: Theme.radius.pill,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  lockedBadgeText: {
    fontSize: 9,
    color: Colors.textMuted,
  },
  referenceField: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Theme.spacing.md,
    paddingBottom: Theme.spacing.sm,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  referenceLabel: {
    fontSize: Theme.fontSize.sm,
    color: Colors.textMuted,
    flexShrink: 0,
  },
  referenceValue: {
    fontSize: Theme.fontSize.sm,
    color: Colors.textPrimary,
    textAlign: 'right',
    flex: 1,
  },

  userCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 0.5,
    borderColor: Colors.goldBorder,
    borderRadius: Theme.radius.lg,
    padding: Theme.spacing.lg,
    gap: Theme.spacing.md,
  },
  userCardTitle: {
    fontSize: Theme.fontSize.md,
    fontWeight: '500',
    color: Colors.gold,
  },
  userField: { gap: Theme.spacing.sm },
  userFieldLabel: {
    fontSize: Theme.fontSize.sm,
    color: Colors.textMuted,
  },
  userInput: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 0.5,
    borderColor: 'rgba(245,197,24,0.18)',
    borderRadius: Theme.radius.md,
    padding: Theme.spacing.md,
    color: Colors.textPrimary,
    fontSize: Theme.fontSize.md,
  },
  notesInput: {
    height: 80,
    textAlignVertical: 'top',
  },
  priceInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 0.5,
    borderColor: 'rgba(245,197,24,0.18)',
    borderRadius: Theme.radius.md,
    paddingHorizontal: Theme.spacing.md,
  },
  priceCurrency: {
    fontSize: Theme.fontSize.md,
    color: Colors.gold,
    marginRight: 4,
  },
  priceTextInput: {
    flex: 1,
    paddingVertical: Theme.spacing.md,
    color: Colors.textPrimary,
    fontSize: Theme.fontSize.md,
  },
  conditionOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Theme.spacing.sm,
  },
  conditionOption: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: Theme.radius.pill,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  conditionOptionSelected: {
    backgroundColor: Colors.goldFaint,
    borderColor: 'rgba(245,197,24,0.45)',
  },
  conditionOptionText: {
    fontSize: Theme.fontSize.sm,
    color: Colors.textMuted,
  },
  conditionOptionTextSelected: {
    color: Colors.gold,
    fontWeight: '500',
  },
  addButton: {
    backgroundColor: Colors.crimson,
    borderRadius: Theme.radius.pill,
    padding: Theme.spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.goldBorder,
  },
  addButtonText: {
    color: '#fff',
    fontSize: Theme.fontSize.md,
    fontWeight: '500',
  },

  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Theme.screenPadding,
    gap: Theme.spacing.lg,
  },
  successEmoji: { fontSize: 64 },
  successTitle: {
    fontSize: Theme.fontSize.xxl,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  successSubtitle: {
    fontSize: Theme.fontSize.md,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
  successImage: {
    width: 160,
    height: 160,
    borderRadius: Theme.radius.lg,
    borderWidth: 2,
    borderColor: Colors.goldBorder,
  },
  successButtons: {
    width: '100%',
    gap: Theme.spacing.md,
    marginTop: Theme.spacing.md,
  },
  addAnotherButton: {
    backgroundColor: Colors.crimson,
    borderRadius: Theme.radius.pill,
    padding: Theme.spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.goldBorder,
  },
  addAnotherButtonText: {
    color: '#fff',
    fontSize: Theme.fontSize.md,
    fontWeight: '500',
  },
  viewCollectionButton: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: Theme.radius.pill,
    padding: Theme.spacing.md,
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: Colors.goldBorder,
  },
  viewCollectionButtonText: {
    color: Colors.gold,
    fontSize: Theme.fontSize.md,
  },
});