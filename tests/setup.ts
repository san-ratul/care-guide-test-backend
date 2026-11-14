import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

// Provide secrets before any module imports read env.ts
process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-value-for-jest-run-0123456789abcdef';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-value-for-jest-run-0123456789abcdef';
process.env.BCRYPT_COST = '4';

const globalRef = globalThis as typeof globalThis & {
  __MONGO_MEMORY_SERVER__?: MongoMemoryServer;
};

export async function getTestDatabase(): Promise<MongoMemoryServer> {
  if (!globalRef.__MONGO_MEMORY_SERVER__) {
    globalRef.__MONGO_MEMORY_SERVER__ = await MongoMemoryServer.create();
  }
  return globalRef.__MONGO_MEMORY_SERVER__;
}

export async function connectTestDatabase(): Promise<void> {
  const server = await getTestDatabase();
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(server.getUri('care_guide_test'));
  }
}

export async function clearDatabase(): Promise<void> {
  if (mongoose.connection.readyState === 0) {
    await connectTestDatabase();
  }
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((collection) => collection.deleteMany({})));
}

export async function disconnectTestDatabase(): Promise<void> {
  await mongoose.disconnect();
  if (globalRef.__MONGO_MEMORY_SERVER__) {
    await globalRef.__MONGO_MEMORY_SERVER__.stop();
    globalRef.__MONGO_MEMORY_SERVER__ = undefined;
  }
}
