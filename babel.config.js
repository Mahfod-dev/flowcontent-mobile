// AUDIT B6 — Strip `console.*` calls from the JS bundle in production so
// they don't ship to App Store / Play Store. The few dev-only diagnostics
// guarded by `__DEV__` survive (the guard short-circuits before the strip).
module.exports = function (api) {
  api.cache(true);
  const isProd = process.env.NODE_ENV === 'production' || process.env.BABEL_ENV === 'production';
  return {
    presets: ['babel-preset-expo'],
    plugins: isProd ? ['transform-remove-console'] : [],
  };
};
