// Minimal setup for jest-expo
// Mock expo modules that cause issues in test environment
jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'fr' }],
}));
