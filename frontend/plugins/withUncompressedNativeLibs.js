/**
 * Config plugin: Disable compressed native libraries in AAB builds.
 * 
 * Fixes: SIGSEGV crash on Play Store (AAB split APKs) while direct APK install works.
 * Root cause: When native libs are compressed in AAB, Play Store split APKs
 * may fail to load them correctly on certain devices (e.g., Vivo V50).
 * 
 * Sets android.bundle.enableUncompressedNativeLibs=false in gradle.properties
 */
const { withGradleProperties } = require('@expo/config-plugins');

function withUncompressedNativeLibs(config) {
  return withGradleProperties(config, (config) => {
    // Remove existing property if present
    config.modResults = config.modResults.filter(
      (item) => !(item.type === 'property' && item.key === 'android.bundle.enableUncompressedNativeLibs')
    );
    
    // Add the property set to false (disables compression of native libs in AAB)
    config.modResults.push({
      type: 'property',
      key: 'android.bundle.enableUncompressedNativeLibs',
      value: 'false',
    });
    
    return config;
  });
}

module.exports = withUncompressedNativeLibs;
