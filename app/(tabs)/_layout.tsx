// ============================================================
// PINCHANTED — Tab Bar Layout
// app/(tabs)/_layout.tsx
// ============================================================

import { Tabs } from 'expo-router';
import { View } from 'react-native';
import Svg, { Path, Rect, Polyline } from 'react-native-svg';
import { Colors } from '../../src/constants/colors';
import { Theme } from '../../src/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlobalHeader } from '../../src/components/GlobalHeader';

const HomeIcon = ({ color }: { color: string }) => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
    <Path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"
      stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    <Polyline points="9,22 9,12 15,12 15,22"
      stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const CollectionIcon = ({ color }: { color: string }) => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
    <Rect x={3} y={3} width={7} height={7} stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
    <Rect x={14} y={3} width={7} height={7} stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
    <Rect x={3} y={14} width={7} height={7} stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
    <Rect x={14} y={14} width={7} height={7} stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
  </Svg>
);

const WishlistIcon = ({ color }: { color: string }) => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
    <Path
      d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
      stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const MarketplaceIcon = ({ color }: { color: string }) => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
    <Path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"
      stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M3 6h18" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    <Path d="M16 10a4 4 0 0 1-8 0" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
  </Svg>
);

const TradesIcon = ({ color }: { color: string }) => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
    <Path d="M17 1l4 4-4 4" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M3 11V9a4 4 0 0 1 4-4h14" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    <Path d="M7 23l-4-4 4-4" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M21 13v2a4 4 0 0 1-4 4H3" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
  </Svg>
);

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1 }}>
      <GlobalHeader />
      <Tabs
        screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.overlay,
          borderTopWidth: 0.5,
          borderTopColor: Colors.goldBorder,
          height: Theme.tabBarHeight + insets.bottom,
          paddingBottom: insets.bottom + 4,
          paddingTop: 8,
        },
        tabBarActiveTintColor: Colors.gold,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarLabelStyle: {
          fontSize: Theme.fontSize.xs,
          fontWeight: Theme.fontWeight.regular,
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <HomeIcon color={color} />,
        }}
      />
      <Tabs.Screen
        name="collection"
        options={{
          title: 'Collection',
          tabBarIcon: ({ color }) => <CollectionIcon color={color} />,
        }}
      />
      <Tabs.Screen
        name="wishlist"
        options={{
          title: 'Wishlist',
          tabBarIcon: ({ color }) => <WishlistIcon color={color} />,
        }}
      />
      <Tabs.Screen
        name="marketplace"
        options={{
          title: 'Marketplace',
          tabBarIcon: ({ color }) => <MarketplaceIcon color={color} />,
        }}
      />
      <Tabs.Screen
        name="trades"
        options={{
          title: 'Trades',
          tabBarIcon: ({ color }) => <TradesIcon color={color} />,
        }}
      />
      </Tabs>
    </View>
  );
}