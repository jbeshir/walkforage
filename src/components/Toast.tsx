// Toast Component - Non-modal notification for rapid feedback
import React, { useEffect, useMemo } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

export type ToastType = 'success' | 'error' | 'info';

// Lookup table for toast background colors
const TOAST_COLORS: Record<ToastType, string> = {
  success: '#4CAF50',
  error: '#f44336',
  info: '#2196F3',
};

export interface ToastMessage {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastItemProps {
  toast: ToastMessage;
  onDismiss: (id: string) => void;
  duration?: number;
}

function ToastItem({ toast, onDismiss, duration = 1500 }: ToastItemProps) {
  // Using useMemo to create stable animated values that persist across renders
  const animatedValues = useMemo(
    () => ({
      opacity: new Animated.Value(0),
      translateY: new Animated.Value(-20),
    }),
    []
  );

  useEffect(() => {
    const { opacity, translateY } = animatedValues;

    // Fade in
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();

    // Auto dismiss after duration
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: -20,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => {
        onDismiss(toast.id);
      });
    }, duration);

    return () => clearTimeout(timer);
  }, [animatedValues, onDismiss, toast.id, duration]);

  const backgroundColor = TOAST_COLORS[toast.type];

  return (
    <Animated.View
      style={[
        styles.toast,
        {
          backgroundColor,
          opacity: animatedValues.opacity,
          transform: [{ translateY: animatedValues.translateY }],
        },
      ]}
    >
      <Text style={styles.toastText}>{toast.message}</Text>
    </Animated.View>
  );
}

interface ToastContainerProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <View style={styles.container} pointerEvents="none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 1000,
  },
  toast: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 8,
    maxWidth: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  toastText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
});
