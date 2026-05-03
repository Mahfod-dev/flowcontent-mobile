/**
 * Tests for theme constants
 */
import { colors, DRAWER_WIDTH, markdownTheme } from '../theme';

describe('theme', () => {
  it('has all required color tokens', () => {
    expect(colors.primary).toBeDefined();
    expect(colors.accent).toBeDefined();
    expect(colors.text).toBeDefined();
    expect(colors.textSecondary).toBeDefined();
    expect(colors.border).toBeDefined();
    expect(colors.white).toBeDefined();
    expect(colors.overlay).toBeDefined();
  });

  it('DRAWER_WIDTH is a reasonable number', () => {
    expect(DRAWER_WIDTH).toBeGreaterThan(200);
    expect(DRAWER_WIDTH).toBeLessThan(400);
  });

  it('markdownTheme has body styles', () => {
    expect(markdownTheme.body).toBeDefined();
    expect(markdownTheme.body.color).toBe(colors.text);
  });

  it('colors are hex strings', () => {
    expect(colors.primary).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(colors.accent).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(colors.text).toMatch(/^#[0-9a-fA-F]{6}$/);
  });
});
