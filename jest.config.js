module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/src/tests/**/*.test.ts?(x)'],
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
};


