module.exports = {
  "testEnvironment": "node",
  "testMatch": [
    "**/__tests__/**/*.ts",
    "**/?(*.)+(spec|test).ts"
  ],
  "collectCoverageFrom": [
    "*.{ts,js}",
    "!*.d.ts"
  ],
  "testTimeout": 30000,
  "maxWorkers": 4,
  "verbose": true,
  "forceExit": true,
  "detectOpenHandles": true,
  "transform": {
    "^.+\\.ts$": "ts-jest"
  },
  "preset": "ts-jest"
};