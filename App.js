import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';

import HomeScreen from './src/screens/HomeScreen';
import AddMedicineScreen from './src/screens/AddMedicineScreen';
import { pedirPermissoes } from './src/utils/notifications';

const Stack = createNativeStackNavigator();

export default function App() {
  useEffect(() => {
    pedirPermissoes();
  }, []);

  return (
    <NavigationContainer>
      <StatusBar style="auto" />
      <Stack.Navigator>
        <Stack.Screen
          name="Home"
          component={HomeScreen}
          options={{ title: 'Meus Remédios' }}
        />
        <Stack.Screen
          name="AdicionarRemedio"
          component={AddMedicineScreen}
          options={{ title: 'Novo Remédio' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
