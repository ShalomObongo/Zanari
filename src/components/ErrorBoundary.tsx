import React, { Component, ErrorInfo, ReactNode } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';

type FallbackRenderParams = {
  error: Error | null;
  reset: () => void;
};

export type ErrorBoundaryFallback = ReactNode | ((params: FallbackRenderParams) => ReactNode);

export interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ErrorBoundaryFallback;
  title?: string;
  description?: string;
  onReset?: () => void;
  reportError?: (error: Error, info: ErrorInfo) => void;
  resetKeys?: unknown[];
  theme?: any; // Theme injected from wrapper
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

const arrayShallowEqual = (a: unknown[] = [], b: unknown[] = []): boolean => {
  if (a === b) {
    return true;
  }
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i += 1) {
    if (!Object.is(a[i], b[i])) {
      return false;
    }
  }
  return true;
};

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  public state: ErrorBoundaryState = {
    hasError: false,
    error: null,
  };

  public componentDidCatch(error: Error, info: ErrorInfo) {
    this.props.reportError?.(error, info);
  }

  public componentDidUpdate(prevProps: ErrorBoundaryProps) {
    if (this.state.hasError && !arrayShallowEqual(prevProps.resetKeys, this.props.resetKeys)) {
      this.reset();
    }
  }

  private reset = () => {
    this.setState({ hasError: false, error: null }, () => {
      this.props.onReset?.();
    });
  };

  private renderFallback() {
    const { fallback, title = 'Something went wrong', description = 'Please try again in a moment.', theme } = this.props;
    const { error } = this.state;

    if (typeof fallback === 'function') {
      return fallback({ error, reset: this.reset });
    }

    if (fallback) {
      return fallback;
    }

    const styles = createStyles(theme);

    return (
      <View style={styles.container} accessibilityRole="alert">
        <View style={styles.card}>
          <Text style={styles.icon}>⚠️</Text>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.description}>{description}</Text>

          {__DEV__ && error && (
            <View style={styles.debugContainer}>
              <Text style={styles.debugLabel}>Debug info</Text>
              <Text style={styles.debugMessage}>{error.message}</Text>
            </View>
          )}

          <TouchableOpacity style={styles.button} onPress={this.reset} activeOpacity={0.85}>
            <Text style={styles.buttonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  public render(): ReactNode {
    if (this.state.hasError) {
      return this.renderFallback();
    }

    return this.props.children;
  }
}

// Wrapper component to inject theme into ErrorBoundary
const ErrorBoundaryWithTheme: React.FC<Omit<ErrorBoundaryProps, 'theme'>> = (props) => {
  const { theme } = useTheme();
  return <ErrorBoundary {...props} theme={theme} />;
};

export const withErrorBoundary = <P extends object>(
  WrappedComponent: React.ComponentType<P>,
  boundaryProps?: Omit<ErrorBoundaryProps, 'children' | 'theme'>,
): React.FC<P> => {
  const ComponentWithBoundary: React.FC<P> = (props: P) => (
    <ErrorBoundaryWithTheme {...boundaryProps}>
      <WrappedComponent {...props} />
    </ErrorBoundaryWithTheme>
  );

  ComponentWithBoundary.displayName = `withErrorBoundary(${WrappedComponent.displayName ?? WrappedComponent.name ?? 'Component'})`;

  return ComponentWithBoundary;
};

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: theme?.colors?.background || '#F8FAFC',
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: theme?.colors?.surface || '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
    shadowColor: '#0B3D3D',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 14 },
    shadowRadius: 28,
    elevation: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme?.colors?.border || 'rgba(10, 92, 90, 0.08)',
  },
  icon: {
    fontSize: 40,
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: theme?.colors?.primary || '#0A5C5A',
    marginBottom: 8,
    textAlign: 'center',
  },
  description: {
    fontSize: 15,
    color: theme?.colors?.textSecondary || '#475467',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
  },
  debugContainer: {
    width: '100%',
    backgroundColor: theme?.isDark ? 'rgba(82, 183, 136, 0.1)' : 'rgba(10, 92, 90, 0.08)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  debugLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: theme?.colors?.primary || '#0A5C5A',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  debugMessage: {
    fontSize: 13,
    color: theme?.colors?.textPrimary || '#0F172A',
    lineHeight: 18,
  },
  button: {
    marginTop: 8,
    backgroundColor: theme?.colors?.primary || '#0A5C5A',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 28,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme?.colors?.surface || '#FFFFFF',
  },
});

export default ErrorBoundaryWithTheme;
export { ErrorBoundary };
