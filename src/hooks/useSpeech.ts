import { useState, useCallback, useEffect, useRef } from 'react';
import { Alert } from 'react-native';

let SpeechModule: any = null;

try {
  const mod = require('expo-speech-recognition');
  SpeechModule = mod.ExpoSpeechRecognitionModule;
} catch {}

export function useSpeech(onResult: (text: string) => void) {
  const [isListening, setIsListening] = useState(false);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  // Register imperative event listeners (not hooks) — safe regardless of module availability
  useEffect(() => {
    if (!SpeechModule) return;

    const startSub = SpeechModule.addListener('start', () => setIsListening(true));
    const endSub = SpeechModule.addListener('end', () => setIsListening(false));
    const resultSub = SpeechModule.addListener('result', (event: any) => {
      const text = event.results?.[0]?.transcript;
      if (text) onResultRef.current(text);
    });

    return () => {
      startSub?.remove?.();
      endSub?.remove?.();
      resultSub?.remove?.();
    };
  }, []);

  const toggle = useCallback(async () => {
    if (!SpeechModule) {
      Alert.alert('Non disponible', 'La reconnaissance vocale nécessite un build natif.');
      return;
    }
    if (isListening) {
      SpeechModule.stop();
      return;
    }
    const { granted } = await SpeechModule.requestPermissionsAsync();
    if (!granted) {
      Alert.alert('Permission micro refusée', 'Activez le micro dans les réglages.');
      return;
    }
    SpeechModule.start({ lang: 'fr-FR', interimResults: false, continuous: false });
  }, [isListening]);

  return { isListening, toggle, available: !!SpeechModule };
}
