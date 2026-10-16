const { withAndroidManifest } = require('@expo/config-plugins');

module.exports = function withAndroidTrackPlayer(config) {
  return withAndroidManifest(config, async (config) => {
    const mainApplication = config.modResults.manifest.application[0];

    if (!mainApplication.service) {
      mainApplication.service = [];
    }

    const serviceName = 'com.doublesymmetry.trackplayer.service.MusicService';
    const existing = mainApplication.service.find(
      (s) => s.$ && s.$['android:name'] === serviceName
    );

    if (!existing) {
      mainApplication.service.push({
        $: {
          'android:name': serviceName,
          'android:exported': 'false',
          'android:foregroundServiceType': 'mediaPlayback',
        },
      });
    } else {
      existing.$['android:foregroundServiceType'] = 'mediaPlayback';
    }

    return config;
  });
};