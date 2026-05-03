/**
 * Tests for i18n translation completeness
 */
import fr from '../i18n/fr';
import en from '../i18n/en';

describe('i18n translations', () => {
  const frKeys = Object.keys(fr).sort();
  const enKeys = Object.keys(en).sort();

  it('FR and EN have the same keys', () => {
    expect(frKeys).toEqual(enKeys);
  });

  it('no empty values in FR', () => {
    for (const key of frKeys) {
      expect((fr as any)[key]).toBeTruthy();
    }
  });

  it('no empty values in EN', () => {
    for (const key of enKeys) {
      expect((en as any)[key]).toBeTruthy();
    }
  });

  it('has all required screen sections', () => {
    const requiredKeys = [
      'login', 'signup', 'logout',
      'writeMessage', 'sendMessage',
      'dashboard', 'notifications', 'profile',
      'myFiles', 'upgrade',
      'sessionExpired',
    ];
    for (const key of requiredKeys) {
      expect(frKeys).toContain(key);
      expect(enKeys).toContain(key);
    }
  });
});
