import { View, Text } from 'react-native';
import { Colors } from '../../src/constants/colors';

export default function AdminTradesScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: Colors.backgroundDark,
      alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: Colors.gold, fontSize: 18 }}>
        🔄 Trade Oversight — coming soon
      </Text>
    </View>
  );
}