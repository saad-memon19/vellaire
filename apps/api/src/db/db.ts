import mongoose, { Model } from 'mongoose';
import { MODELS } from './schemas';

type ModelMap = { [K in keyof typeof MODELS]: Model<any> };

function build(): ModelMap {
  const out = {} as ModelMap;
  for (const [name, schema] of Object.entries(MODELS)) {
    (out as any)[name] = mongoose.models[name] || mongoose.model(name, schema);
  }
  return out;
}

/** All collections, shared across the app: `db.Card.find(...)`. */
export const db = build();

export async function connectDb(uri: string) {
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 20000 });
  return mongoose.connection;
}
