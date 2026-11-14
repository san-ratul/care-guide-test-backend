import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/tests"],
  setupFilesAfterEnv: ["<rootDir>/tests/setup.ts"],
  testTimeout: 120000,
  clearMocks: true,
  verbose: true,
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        tsconfig: {
          module: "commonjs",
          types: ["node", "jest"],
          resolveJsonModule: true,
          esModuleInterop: true,
        },
      },
    ],
  },
  maxWorkers: 1,
};

export default config;
