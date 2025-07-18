import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';

export default function RootLayout() {

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: '#007AFF',
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        }}
      >
        <Stack.Screen 
          name="index" 
          options={{ title: 'LEAI Assistant' }}
        />
        <Stack.Screen 
          name="knowledge-base" 
          options={{ title: 'Knowledge Base' }}
        />
        <Stack.Screen 
          name="settings" 
          options={{ title: 'Settings' }}
        />
      </Stack>
    </>
  );
} 