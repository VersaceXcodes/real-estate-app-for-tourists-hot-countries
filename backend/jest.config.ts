module.exports = {
  "testEnvironment": "node",

  "testMatch": [
    "**/__tests__/**/*.ts",
    "**/?(*.)+(spec|test).ts"
  ],
  "collectCoverageFrom": [
    "src/**/*.{ts,js}",
    "!src/**/*.d.ts",
    "!src/types/**/*"
  ],
  "coverageThreshold": {
    "global": {
      "branches": 80,
      "functions": 85,
      "lines": 85,
      "statements": 85
    }
  },
  "testTimeout": 30000,
  "maxWorkers": 4,
  "verbose": true,
  "forceExit": true,
  "detectOpenHandles": true,
  "moduleNameMapper": {
    "^@/(.*)$": "<rootDir>/src/$1"
  },
  "transform": {
    "^.+\\.ts$": "ts-jest"
  },

  "preset": "ts-jest"
};