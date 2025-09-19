import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { useState } from 'react';
import { testConnection } from './lib/supabase';

export default function App() {
  const [connectionStatus, setConnectionStatus] = useState<string>('Not tested');

  const handleTestConnection = async () => {
    setConnectionStatus('Testing...');
    const result = await testConnection();
    setConnectionStatus(result.success ? result.message : `Error: ${result.error}`);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Zanari Mobile App</Text>
      <TouchableOpacity style={styles.button} onPress={handleTestConnection}>
        <Text style={styles.buttonText}>Test Supabase Connection</Text>
      </TouchableOpacity>
      <Text style={styles.status}>Status: {connectionStatus}</Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 30,
  },
  button: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  status: {
    fontSize: 14,
    textAlign: 'center',
    color: '#666',
  },
});
