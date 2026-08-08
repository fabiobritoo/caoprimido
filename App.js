import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';

import HomeScreen from './src/screens/HomeScreen';
import AddMedicineScreen from './src/screens/AddMedicineScreen';
import ManageMedicinesScreen from './src/screens/ManageMedicinesScreen';
import { pedirPermissoes } from './src/utils/notifications';
import { CORES } from './src/utils/tema';

const Stack = createNativeStackNavigator();

export default function App() {
  useEffect(() => {
    pedirPermissoes();
  }, []);

  return (
    <NavigationContainer>
      <StatusBar style="light" />
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: CORES.primaria },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: '700' },
        }}
      >
        <Stack.Screen
          name="Home"
          component={HomeScreen}
          options={{ title: 'Cãoprimido' }}
        />
        <Stack.Screen
          name="AdicionarRemedio"
          component={AddMedicineScreen}
          options={{ title: 'Novo Remédio' }}
        />
        <Stack.Screen
          name="GerenciarRemedios"
          component={ManageMedicinesScreen}
          options={{ title: 'Meus Remédios' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
