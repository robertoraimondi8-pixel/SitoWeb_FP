import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={s.container}>
          <Text style={s.title}>Qualcosa è andato storto</Text>
          <Text style={s.message}>{this.state.error?.message || 'Errore sconosciuto'}</Text>
          <TouchableOpacity
            style={s.button}
            onPress={() => this.setState({ hasError: false, error: null })}
          >
            <Text style={s.buttonText}>Riprova</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const s = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0A1628', padding: 24 },
  title: { color: '#F5A623', fontSize: 20, fontWeight: '700', marginBottom: 12 },
  message: { color: '#94A3B8', fontSize: 14, textAlign: 'center', marginBottom: 24 },
  button: { backgroundColor: '#F5A623', paddingHorizontal: 32, paddingVertical: 12, borderRadius: 8 },
  buttonText: { color: '#0A1628', fontWeight: '700', fontSize: 16 },
});
