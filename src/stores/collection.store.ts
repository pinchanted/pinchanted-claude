// ============================================================
// PINCHANTED — Collection Store
// src/stores/collection.store.ts
// ============================================================

import { create } from 'zustand';
import { getCollection } from '../lib/supabase';
import { CollectionPin } from '../types/database.types';

type GroupBy = 'series' | 'theme' | 'trade_status' | 'all';

interface CollectionState {
  pins: CollectionPin[];
  isLoading: boolean;
  groupBy: GroupBy;
  searchQuery: string;
  filteredPins: CollectionPin[];
  groupedPins: Record<string, CollectionPin[]>;
  tradeStatusCounts: {
    committed: number;
    on_table: number;
    requested: number;
    available: number;
  };
  fetchCollection: (userId: string) => Promise<void>;
  setGroupBy: (groupBy: GroupBy) => void;
  setSearchQuery: (query: string) => void;
  updatePin: (pinId: string, updates: Partial<CollectionPin>) => void;
  removePin: (pinId: string) => void;
  addPin: (pin: CollectionPin) => void;
}

const getPinName = (pin: CollectionPin) =>
  pin.reference_pin?.name || pin.community_pin?.name || '';

const groupPins = (
  pins: CollectionPin[],
  groupBy: GroupBy
): Record<string, CollectionPin[]> => {
  if (groupBy === 'all') return { 'All pins': pins };

  if (groupBy === 'trade_status') {
    return {
      '🔴 Committed': pins.filter(p => p.trade_status === 'committed'),
      '🟡 On the table': pins.filter(p => p.trade_status === 'on_table'),
      '🔵 Wanted by others': pins.filter(p => p.trade_status === 'requested'),
      '✅ Available': pins.filter(p => p.trade_status === 'available'),
    };
  }

  if (groupBy === 'series') {
    return pins.reduce((groups, pin) => {
      const series =
        pin.reference_pin?.series_name ||
        pin.community_pin?.series_name ||
        'Other';
      if (!groups[series]) groups[series] = [];
      groups[series].push(pin);
      return groups;
    }, {} as Record<string, CollectionPin[]>);
  }

  if (groupBy === 'theme') {
    return pins.reduce((groups, pin) => {
      const theme =
        pin.reference_pin?.series_name ||
        pin.community_pin?.series_name ||
        'Other';
      if (!groups[theme]) groups[theme] = [];
      groups[theme].push(pin);
      return groups;
    }, {} as Record<string, CollectionPin[]>);
  }

  return { 'All pins': pins };
};

const getTradeStatusCounts = (pins: CollectionPin[]) => ({
  committed: pins.filter(p => p.trade_status === 'committed').length,
  on_table: pins.filter(p => p.trade_status === 'on_table').length,
  requested: pins.filter(p => p.trade_status === 'requested').length,
  available: pins.filter(p => p.trade_status === 'available').length,
});

const filterPins = (pins: CollectionPin[], query: string) =>
  query
    ? pins.filter(p =>
        getPinName(p).toLowerCase().includes(query.toLowerCase())
      )
    : pins;

export const useCollectionStore = create<CollectionState>((set, get) => ({
  pins: [],
  isLoading: false,
  groupBy: 'series',
  searchQuery: '',
  filteredPins: [],
  groupedPins: {},
  tradeStatusCounts: {
    committed: 0,
    on_table: 0,
    requested: 0,
    available: 0,
  },

  fetchCollection: async (userId: string) => {
    set({ isLoading: true });
    const { data, error } = await getCollection(userId);

    if (error) {
      console.error('Error fetching collection:', error);
      set({ isLoading: false });
      return;
    }

    const pins = (data as CollectionPin[]) || [];
    const { groupBy, searchQuery } = get();
    const filtered = filterPins(pins, searchQuery);

    set({
      pins,
      filteredPins: filtered,
      groupedPins: groupPins(filtered, groupBy),
      isLoading: false,
      tradeStatusCounts: getTradeStatusCounts(pins),
    });
  },

  setGroupBy: (groupBy: GroupBy) => {
    const { filteredPins } = get();
    set({
      groupBy,
      groupedPins: groupPins(filteredPins, groupBy),
    });
  },

  setSearchQuery: (query: string) => {
    const { pins, groupBy } = get();
    const filtered = filterPins(pins, query);
    set({
      searchQuery: query,
      filteredPins: filtered,
      groupedPins: groupPins(filtered, groupBy),
    });
  },

  updatePin: (pinId: string, updates: Partial<CollectionPin>) => {
    const { pins, groupBy, searchQuery } = get();
    const updated = pins.map(p =>
      p.id === pinId ? { ...p, ...updates } : p
    );
    const filtered = filterPins(updated, searchQuery);
    set({
      pins: updated,
      filteredPins: filtered,
      groupedPins: groupPins(filtered, groupBy),
      tradeStatusCounts: getTradeStatusCounts(updated),
    });
  },

  removePin: (pinId: string) => {
    const { pins, groupBy, searchQuery } = get();
    const updated = pins.filter(p => p.id !== pinId);
    const filtered = filterPins(updated, searchQuery);
    set({
      pins: updated,
      filteredPins: filtered,
      groupedPins: groupPins(filtered, groupBy),
      tradeStatusCounts: getTradeStatusCounts(updated),
    });
  },

  addPin: (pin: CollectionPin) => {
    const { pins, groupBy, searchQuery } = get();
    const updated = [pin, ...pins];
    const filtered = filterPins(updated, searchQuery);
    set({
      pins: updated,
      filteredPins: filtered,
      groupedPins: groupPins(filtered, groupBy),
      tradeStatusCounts: getTradeStatusCounts(updated),
    });
  },
}));