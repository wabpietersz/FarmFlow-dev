import { config } from './config';
import app from './app';
import logger from './lib/logger';
import { loadAccessMatrix } from './lib/permissions';
import { startNotificationSchedule } from './lib/notifications';

const PORT = config.port;

void loadAccessMatrix();
// Vaccinations due, stock, cheques, approvals, late payers → the bell, every 30 minutes
if (process.env.NODE_ENV !== 'test') startNotificationSchedule();

app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`, {
    env: config.nodeEnv,
    port: PORT,
  });
});
