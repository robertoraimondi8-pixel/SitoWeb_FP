import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  componentStack: string;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, componentStack: '' };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
    this.setState({ componentStack: errorInfo?.componentStack || '' });
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={s.container}>
          <Text style={s.title}>Qualcosa è andato storto</Text>
          <Text style={s.message}>{this.state.error?.message || 'Errore sconosciuto'}</Text>
          {this.state.componentStack ? (
            <ScrollView style={s.stackScroll} contentContainerStyle={s.stackContent}>
              <Text style={s.stackText} selectable>{this.state.componentStack.substring(0, 500)}</Text>
            </ScrollView>
          ) : null}
          <TouchableOpacity
            style={s.button}
            onPress={() => this.setState({ hasError: false, error: null, componentStack: '' })}
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
  stackScroll: { maxHeight: 120, marginBottom: 16, paddingHorizontal: 16 },
  stackContent: { paddingBottom: 8 },
  stackText: { color: '#64748B', fontSize: 10, fontFamily: 'monospace' },
});
