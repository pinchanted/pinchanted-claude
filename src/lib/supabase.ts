import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY as string;

// Use AsyncStorage on native, localStorage on web
const storage = Platform.OS === 'web'
  ? {
      getItem: (key: string) =>
        Promise.resolve(localStorage.getItem(key)),
      setItem: (key: string, value: string) =>
        Promise.resolve(localStorage.setItem(key, value)),
      removeItem: (key: string) =>
        Promise.resolve(localStorage.removeItem(key)),
    }
  : AsyncStorage;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export const signUpWithEmail = async (
  email: string,
  password: string,
  username: string,
  displayName: string
) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        username,
        full_name: displayName,
      },
    },
  });
  return { data, error };
};

export const signInWithEmail = async (
  email: string,
  password: string
) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  return { data, error };
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  return { error };
};

export const getCurrentUser = async () => {
  const { data: { user }, error } = await supabase.auth.getUser();
  return { user, error };
};

export const resetPassword = async (email: string) => {
  const { data, error } = await supabase.auth.resetPasswordForEmail(
    email,
    { redirectTo: 'https://pinchanted.ca/reset-password' }
  );
  return { data, error };
};

export const getProfile = async (userId: string) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  return { data, error };
};

export const updateProfile = async (
  userId: string,
  updates: Record<string, unknown>
) => {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single();
  return { data, error };
};

export const checkUsernameAvailable = async (username: string) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('username')
    .eq('username', username)
    .maybeSingle();
  return { available: !data, error };
};

export const getCollection = async (userId: string) => {
  const { data, error } = await supabase
    .from('collection_pins')
    .select(`
      *,
      reference_pin:reference_pins(*),
      community_pin:community_pins(*)
    `)
    .eq('user_id', userId)
    .eq('is_deleted', false)
    .order('added_at', { ascending: false });
  return { data, error };
};

export const addToCollection = async (pinData: {
  user_id: string;
  reference_pin_id?: string;
  community_pin_id?: string;
  my_purchase_price?: number;
  condition?: string;
  notes?: string;
  my_image_path?: string;
}) => {
  const { data, error } = await supabase
    .from('collection_pins')
    .insert(pinData)
    .select()
    .single();
  return { data, error };
};

export const updateCollectionPin = async (
  pinId: string,
  updates: Record<string, unknown>
) => {
  const { data, error } = await supabase
    .from('collection_pins')
    .update(updates)
    .eq('id', pinId)
    .select()
    .single();
  return { data, error };
};

export const removeFromCollection = async (pinId: string) => {
  // Check if pin is in any active trade — block deletion if so
  const { data: activeTrades } = await supabase
    .from('trades')
    .select('id')
    .in('status', ['pending', 'confirmed', 'arrange_shipping', 'shipping', 'delivered'])
    .or(`offered_pin_ids.cs.{${pinId}},requested_pin_ids.cs.{${pinId}}`);

  if (activeTrades?.length) {
    return {
      error: {
        message: 'This pin is part of an active trade and cannot be removed until the trade is completed or cancelled.',
      },
      blocked: true,
    };
  }

  // Soft delete the marketplace listing
  await supabase
    .from('marketplace_listings')
    .update({ status: 'removed' })
    .eq('collection_pin_id', pinId);

  // Soft delete the pin — preserves trade history
  const { error } = await supabase
    .from('collection_pins')
    .update({
      is_deleted: true,
      deleted_at: new Date().toISOString(),
    })
    .eq('id', pinId);

  return { error };
};

export const getMarketplaceListings = async (
  userId: string,
  limit: number = 20,
  offset: number = 0
) => {
  const { data, error } = await supabase
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
    .neq('seller_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
  return { data, error };
};

export const getTrades = async (userId: string) => {
  const { data, error } = await supabase
    .from('trades')
    .select(`
      *,
      initiator:profiles!initiator_id(
        id, username, display_name, avatar_url, trade_rating
      ),
      recipient:profiles!recipient_id(
        id, username, display_name, avatar_url, trade_rating
      )
    `)
    .or(`initiator_id.eq.${userId},recipient_id.eq.${userId}`)
    .not('status', 'in', '("completed","declined","expired")')
    .order('updated_at', { ascending: false });
  return { data, error };
};

export const createTrade = async (tradeData: {
  initiator_id: string;
  recipient_id: string;
  requested_pin_ids: string[];
  offered_pin_ids: string[];
}) => {
  const { data, error } = await supabase
    .from('trades')
    .insert(tradeData)
    .select()
    .single();

  if (data && !error) {
    await supabase
      .from('collection_pins')
      .update({ trade_status: 'on_table', trade_id: data.id })
      .in('id', tradeData.offered_pin_ids);
  }

  return { data, error };
};

export const updateTradeStatus = async (
  tradeId: string,
  status: string,
  additionalData?: Record<string, unknown>
) => {
  const { data, error } = await supabase
    .from('trades')
    .update({ status, ...additionalData })
    .eq('id', tradeId)
    .select()
    .single();
  return { data, error };
};

export const getNotifications = async (
  userId: string,
  limit: number = 20
) => {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('sent_at', { ascending: false })
    .limit(limit);
  return { data, error };
};

export const markNotificationRead = async (notificationId: string) => {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId);
  return { error };
};

export const savePushToken = async (
  userId: string,
  token: string,
  platform: 'ios' | 'android'
) => {
  const { error } = await supabase
    .from('push_tokens')
    .upsert(
      { user_id: userId, token, platform },
      { onConflict: 'user_id,token' }
    );
  return { error };
};

export const subscribeToTrade = (
  tradeId: string,
  callback: (payload: unknown) => void
) => {
  return supabase
    .channel(`trade:${tradeId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'trades',
        filter: `id=eq.${tradeId}`,
      },
      callback
    )
    .subscribe();
};

export const subscribeToNotifications = (
  userId: string,
  callback: (payload: unknown) => void
) => {
  return supabase
    .channel(`notifications:${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      },
      callback
    )
    .subscribe();
};

// ============================================================
// PIN IDENTIFICATION
// ============================================================

export const identifyPin = async (
  imageBase64: string,
  imageType: string = 'image/jpeg'
) => {
  const { data, error } = await supabase.functions.invoke('identify-pin', {
    body: {
      image_base64: imageBase64,
      image_type: imageType,
    },
  });
  return { data, error };
};

// ============================================================
// STORAGE HELPERS
// ============================================================

// Compress image - web uses canvas, native passes through
const compressImage = async (
  base64: string,
  imageUri: string
): Promise<{ base64: string; uri: string }> => {
  // On web - use canvas compression
  if (typeof document !== 'undefined') {
    return new Promise((resolve) => {
      try {
        const img = new window.Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_SIZE = 800;
          let width = img.width;
          let height = img.height;

          if (width > height && width > MAX_SIZE) {
            height = (height * MAX_SIZE) / width;
            width = MAX_SIZE;
          } else if (height > MAX_SIZE) {
            width = (width * MAX_SIZE) / height;
            height = MAX_SIZE;
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          const compressed = canvas
            .toDataURL('image/jpeg', 0.7)
            .split(',')[1];
          resolve({ base64: compressed, uri: imageUri });
        };
        img.onerror = () => resolve({ base64, uri: imageUri });
        img.src = `data:image/webp;base64,${base64}`;
      } catch {
        resolve({ base64, uri: imageUri });
      }
    });
  }

  // On native - use expo-image-manipulator to resize
  try {
    const ImageManipulator = require('expo-image-manipulator');
    const result = await ImageManipulator.manipulateAsync(
      imageUri,
      [{ resize: { width: 800 } }],
      {
        compress: 0.7,
        format: ImageManipulator.SaveFormat.JPEG,
        base64: true,
      }
    );
    return {
      base64: result.base64 || base64,
      uri: result.uri,
    };
  } catch {
    return { base64, uri: imageUri };
  }
};

export const uploadPinImage = async (
  userId: string,
  imageUri: string,
  imageBase64: string
): Promise<string | null> => {
  try {
    const base64Data = imageBase64.includes(',')
      ? imageBase64.split(',')[1]
      : imageBase64;

    // Compress image
    const compressed = await compressImage(base64Data, imageUri);
    console.log('Upload: Compressed');

    // Convert to Uint8Array
    const byteCharacters = atob(compressed.base64);
    const byteArray = new Uint8Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteArray[i] = byteCharacters.charCodeAt(i);
    }

    const timestamp = Date.now();
    const filename = `${userId}/${timestamp}.jpg`;

    console.log('Upload: Uploading to Supabase...');
    const { data, error } = await supabase.storage
      .from('user-pins')
      .upload(filename, byteArray, {
        contentType: 'image/jpeg',
        upsert: false,
      });

    if (error) {
      console.error('Upload error:', error);
      return null;
    }

    console.log('Upload: Success:', data.path);
    return data.path;
  } catch (error) {
    console.error('Upload exception:', error);
    return null;
  }
};

export const getPinImageUrl = (
  path: string | null
): string | null => {
  if (!path) return null;
  const { data } = supabase.storage
    .from('user-pins')
    .getPublicUrl(path);
  return data.publicUrl;
};

export const debugAuth = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  const { data: { user } } = await supabase.auth.getUser();
  console.log('Session:', JSON.stringify(session));
  console.log('User:', JSON.stringify(user));
  return { session, user };
};

export const uploadAvatarImage = async (
  userId: string,
  imageUri: string,
  imageBase64: string
): Promise<string | null> => {
  try {
    // Use the base64 already provided by the image picker — no file system needed
    const base64 = imageBase64.includes(',')
      ? imageBase64.split(',')[1]
      : imageBase64;

    // Pure JS base64 → Uint8Array (no Buffer, no atob, no FileSystem)
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    const str = base64.replace(/=+$/, '');
    const bytes: number[] = [];
    let i = 0;
    while (i < str.length) {
      const a = chars.indexOf(str[i++]);
      const b = chars.indexOf(str[i++]);
      const c = i <= str.length ? chars.indexOf(str[i++]) : 0;
      const d = i <= str.length ? chars.indexOf(str[i++]) : 0;
      const bitmap = (a << 18) | (b << 12) | (c << 6) | d;
      bytes.push((bitmap >> 16) & 255);
      if (c !== -1) bytes.push((bitmap >> 8) & 255);
      if (d !== -1) bytes.push(bitmap & 255);
    }
    const byteArray = new Uint8Array(bytes);

    const filename = `${userId}/avatar.jpg`;

    const { data, error } = await supabase.storage
      .from('avatars')
      .upload(filename, byteArray, {
        contentType: 'image/jpeg',
        upsert: true,
      });

    if (error) {
      console.error('Avatar upload error:', JSON.stringify(error));
      return null;
    }

    const { data: urlData } = supabase.storage
      .from('avatars')
      .getPublicUrl(data.path);

    return urlData.publicUrl;
  } catch (err) {
    console.error('Avatar upload exception:', err);
    return null;
  }
};