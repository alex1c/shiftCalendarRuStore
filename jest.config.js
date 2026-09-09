/** @type {import('jest').Config} */
const config = {
	preset: 'jest-expo',
	testMatch: ['**/tests/**/*.test.ts'],
	moduleNameMapper: {
		'^@/(.*)$': '<rootDir>/$1',
	},
	clearMocks: true,
	setupFiles: ['<rootDir>/tests/setup.ts'],
}

module.exports = config
