import { closeDb } from '../db';

afterAll(async () => {
  await closeDb();
});
