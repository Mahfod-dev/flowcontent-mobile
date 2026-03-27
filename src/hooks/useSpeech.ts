import { useState, useCallback } from 'react';
import { Alert } from 'react-native';

let SpeechModule: any = null;
let useEvent: any = null;

try {
  const mod = require('expo-speech-recognition');
  SpeechModule = mod.ExpoSpeechRecognitionModule;
  useEvent = mod.useSpeechRecognitionEvent;
} catch {}

export function useSpeech(onResult: (text: string) => void) {
  const [isListening, setIsListening] = useState(false);

  // Register events only if module exists
  if (useEvent) {
    useEvent('start', () => setIsListening(true));
    useEvent('end', () => setIsListening(false));
    useEvent('result', (event: any) => {
      const text = event.results?.[0]?.transcript;
      if (text) onResult(text);
    });
  }

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
