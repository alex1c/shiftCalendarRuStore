/** AppMetrica 4.2.0 exposes an Android native module without this project-level entry. */
const path = require('path')

module.exports = {
	project: {
		android: {
			packageName: 'com.calculatorplatform.shiftcalendar',
		},
	},
	dependencies: {
		'@appmetrica/react-native-analytics': {
			platforms: {
				android: {
				sourceDir: path.resolve(process.cwd(), 'node_modules/@appmetrica/react-native-analytics/android'),
				},
			},
		},
	},
}
