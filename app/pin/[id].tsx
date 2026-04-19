import { View, Text } from 'react-native';
import { Colors } from '../../src/constants/colors';

export default function PinDetailScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: Colors.backgroundDark,
      alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: Colors.gold, fontSize: 18 }}>
        📌 Pin Detail — coming soon
      </Text>
    </View>
  );
}