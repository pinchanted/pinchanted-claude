// ============================================================
// PINCHANTED — TypeScript Type Definitions
// src/types/database.types.ts
// ============================================================

export type CollectingExperience = 'under-1' | '1-2' | '2-5' | '5-plus';
export type CollectingStyle = 'collector' | 'trader' | 'buyer';
export type TradeStatus =
  | 'pending'
  | 'in_progress'
  | 'confirmed'
  | 'arrange_shipping'
  | 'shipping'
  | 'delivered'
  | 'completed'
  | 'declined'
  | 'expired'
  | 'disputed';
export type PinTradeStatus =
  | 'available'
  | 'on_table'
  | 'requested'
  | 'committed'
  | 'shipped'
  | 'completed';
export type ListingType = 'trade' | 'sale';
export type ListingStatus = 'active' | 'sold' | 'traded' | 'expired' | 'removed';
export type CommunityPinStatus = 'unverified' | 'verified' | 'rejected';
export type ShippingMethod = 'standard' | 'tracked' | 'tracked_insured';
export type Country = 'CA' | 'US';
export type Edition = 'Limited Edition' | 'Open Edition' | 'Limited Release';

export interface Profile {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  avatar_style: string;
  collecting_experience: CollectingExperience | null;
  collecting_style: CollectingStyle[];
  favourite_themes: string[];
  favourite_park: string | null;
  is_admin: boolean;
  is_suspended: boolean;
  suspended_at: string | null;
  suspended_reason: string | null;
  trade_rating: number;
  trades_completed: number;
  trades_disputed: number;
  ship_domestically: boolean;
  ship_internationally: boolean;
  country: Country;
  created_at: string;
  updated_at: string;
}

export interface ShippingAddress {
  id: string;
  user_id: string;
  is_default: boolean;
  is_alternate: boolean;
  label: string;
  country: Country;
  province_state: string;
  city: string;
  street_address: string;
  street_address_2: string | null;
  postal_zip_code: string;
  created_at: string;
}

export interface ReferencePin {
  id: string;
  external_id: string | null;
  name: string;
  series_name: string | null;
  edition: Edition | null;
  origin: string | null;
  original_price: number | null;
  release_date: string | null;
  source_site: string | null;
  source_pin_id: string | null;
  source_url: string | null;
  image_url: string | null;
  stored_image_path: string | null;
  created_at: string;
}

export interface CommunityPin {
  id: string;
  name: string;
  series_name: string | null;
  edition: Edition | null;
  origin: string | null;
  original_price: number | null;
  release_date: string | null;
  contributed_by: string | null;
  confirmation_count: number;
  status: CommunityPinStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  image_path: string | null;
  created_at: string;
}

export interface CollectionPin {
  id: string;
  user_id: string;
  reference_pin_id: string | null;
  community_pin_id: string | null;
  my_purchase_price: number | null;
  condition: string;
  notes: string | null;
  trade_status: PinTradeStatus;
  trade_id: string | null;
  my_image_path: string | null;
  is_wishlisted: boolean;
  added_at: string;
  updated_at: string;
  reference_pin?: ReferencePin;
  community_pin?: CommunityPin;
}

export interface MarketplaceListing {
  id: string;
  seller_id: string;
  collection_pin_id: string;
  listing_type: ListingType;
  asking_price: number | null;
  open_to_trade: boolean;
  open_to_sale: boolean;
  description: string | null;
  status: ListingStatus;
  expires_at: string;
  created_at: string;
  updated_at: string;
  seller?: Profile;
  collection_pin?: CollectionPin;
}

export interface Trade {
  id: string;
  initiator_id: string;
  recipient_id: string;
  status: TradeStatus;
  requested_pin_ids: string[];
  offered_pin_ids: string[];
  confirmed_initiator_pins: string[];
  confirmed_recipient_pins: string[];
  initiator_shipping_method: ShippingMethod;
  recipient_shipping_method: ShippingMethod;
  initiator_carrier: string | null;
  initiator_tracking_number: string | null;
  initiator_proof_image_path: string | null;
  initiator_shipped_at: string | null;
  initiator_received_at: string | null;
  recipient_carrier: string | null;
  recipient_tracking_number: string | null;
  recipient_proof_image_path: string | null;
  recipient_shipped_at: string | null;
  recipient_received_at: string | null;
  counter_count: number;
  last_action_by: string | null;
  expires_at: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  initiator?: Profile;
  recipient?: Profile;
  messages?: TradeMessage[];
}

export interface TradeMessage {
  id: string;
  trade_id: string;
  sender_id: string;
  message: string;
  created_at: string;
  sender?: Profile;
}

export interface TradeRating {
  id: string;
  trade_id: string;
  rater_id: string;
  rated_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
}

export interface TradeDispute {
  id: string;
  trade_id: string;
  raised_by: string;
  reason: string;
  status: 'open' | 'resolved' | 'closed';
  resolved_by: string | null;
  resolution: string | null;
  created_at: string;
  resolved_at: string | null;
}

export type NotificationType =
  | 'trade_offer_received'
  | 'trade_offer_countered'
  | 'trade_offer_accepted'
  | 'trade_offer_declined'
  | 'trade_offer_expiring'
  | 'trade_offer_expired'
  | 'trade_package_shipped'
  | 'trade_proof_uploaded'
  | 'trade_package_received'
  | 'trade_completed'
  | 'trade_disputed'
  | 'wishlist_pin_listed'
  | 'theme_pin_listed'
  | 'listing_interest'
  | 'listing_expired'
  | 'community_pin_verified'
  | 'pin_confirmation_needed'
  | 'trial_ending'
  | 'trial_ended'
  | 'subscription_renewing'
  | 'subscription_failed'
  | 'rating_received'
  | 'admin_pin_submitted'
  | 'admin_dispute_flagged'
  | 'admin_user_flagged';

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, string>;
  is_read: boolean;
  sent_at: string;
}

export interface PushToken {
  id: string;
  user_id: string;
  token: string;
  platform: 'ios' | 'android';
  created_at: string;
}

export interface PinMatchResult {
  id: string;
  name: string;
  series_name: string | null;
  edition: string | null;
  origin: string | null;
  original_price: number | null;
  release_date: string | null;
  stored_image_path: string | null;
  similarity: number;
  source: 'reference' | 'community';
}

export const CANADIAN_PROVINCES = [
  { code: 'AB', name: 'Alberta' },
  { code: 'BC', name: 'British Columbia' },
  { code: 'MB', name: 'Manitoba' },
  { code: 'NB', name: 'New Brunswick' },
  { code: 'NL', name: 'Newfoundland and Labrador' },
  { code: 'NS', name: 'Nova Scotia' },
  { code: 'NT', name: 'Northwest Territories' },
  { code: 'NU', name: 'Nunavut' },
  { code: 'ON', name: 'Ontario' },
  { code: 'PE', name: 'Prince Edward Island' },
  { code: 'QC', name: 'Quebec' },
  { code: 'SK', name: 'Saskatchewan' },
  { code: 'YT', name: 'Yukon' },
] as const;

export const US_STATES = [
  { code: 'AL', name: 'Alabama' },
  { code: 'AK', name: 'Alaska' },
  { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' },
  { code: 'CA', name: 'California' },
  { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' },
  { code: 'DE', name: 'Delaware' },
  { code: 'DC', name: 'District of Columbia' },
  { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' },
  { code: 'HI', name: 'Hawaii' },
  { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' },
  { code: 'IN', name: 'Indiana' },
  { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' },
  { code: 'KY', name: 'Kentucky' },
  { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' },
  { code: 'MD', name: 'Maryland' },
  { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' },
  { code: 'MN', name: 'Minnesota' },
  { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' },
  { code: 'MT', name: 'Montana' },
  { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' },
  { code: 'NH', name: 'New Hampshire' },
  { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' },
  { code: 'NY', name: 'New York' },
  { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' },
  { code: 'OH', name: 'Ohio' },
  { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' },
  { code: 'PA', name: 'Pennsylvania' },
  { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' },
  { code: 'SD', name: 'South Dakota' },
  { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' },
  { code: 'UT', name: 'Utah' },
  { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' },
  { code: 'WA', name: 'Washington' },
  { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' },
  { code: 'WY', name: 'Wyoming' },
] as const;

export const PIN_THEMES = [
  'Mickey & Friends',
  'Princess',
  'Star Wars',
  'Marvel',
  'Pixar',
  'Villains',
  'Attractions',
  'Park Exclusive',
  'Limited Edition',
  'EPCOT',
  'Haunted Mansion',
  'Animal Kingdom',
] as const;

export const DISNEY_PARKS = [
  'Walt Disney World Resort',
  'Disneyland Resort',
  'Disneyland Paris',
  'Tokyo Disney Resort',
  'Hong Kong Disneyland',
  'Shanghai Disneyland',
] as const;