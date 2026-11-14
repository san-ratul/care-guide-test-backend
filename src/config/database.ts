import mongoose from 'mongoose';
import { env } from './env';

mongoose.set('strictQuery', true);

export async function connectDatabase(): Promise<void> {
  const uri = env.MONGODB_URI;
  await mongoose.connect(uri, {
    autoIndex: env.NODE_ENV !== 'production',
    serverSelectionTimeoutMS: 10_000,
  });
  const host = mongoose.connection.host;
  const name = mongoose.connection.name;

  console.log(`[db] connected to ${host}/${name}`);
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}
