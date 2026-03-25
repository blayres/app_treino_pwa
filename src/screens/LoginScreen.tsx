import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { styles } from './LoginScreen.styles';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { useAppStore } from '../store/useAppStore';

type Navigation = NativeStackNavigationProp<RootStackParamList, 'Login'>;

export default function LoginScreen() {
  const navigation = useNavigation<Navigation>();
  const setCurrentUser = useAppStore(state => state.setCurrentUser);

const handleSelectUser = (id: number, name: string) => {
  localStorage.setItem('lastUserId', String(id));
  setCurrentUser({ id, name });
  navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
};

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title}>Escolha o perfil</Text>

        <View style={styles.buttons}>
          <Pressable
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
            onPress={() => handleSelectUser(1, 'Diandra')}
          >
            <Text style={styles.buttonLabel}>Diandra</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
            onPress={() => handleSelectUser(2, 'Barbara')}
          >
            <Text style={styles.buttonLabel}>Barbara</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
