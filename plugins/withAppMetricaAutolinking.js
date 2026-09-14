const { withSettingsGradle } = require('@expo/config-plugins')

/** Keep React Native native-module autolinking enabled for Expo SDK 57. */
function withAppMetricaAutolinking (config) {
	return withSettingsGradle(config, (mod) => {
		const conditional = `extensions.configure(com.facebook.react.ReactSettingsExtension) { ex ->
  if (System.getenv('EXPO_USE_COMMUNITY_AUTOLINKING') == '1') {
    ex.autolinkLibrariesFromCommand()
  } else {
    ex.autolinkLibrariesFromCommand(expoAutolinking.rnConfigCommand)
  }
}`
		const community = `extensions.configure(com.facebook.react.ReactSettingsExtension) { ex ->
  ex.autolinkLibrariesFromCommand()
}`
		if (mod.modResults.contents.includes(conditional)) {
			mod.modResults.contents = mod.modResults.contents.replace(conditional, community)
		}
		return mod
	})
}

module.exports = withAppMetricaAutolinking
