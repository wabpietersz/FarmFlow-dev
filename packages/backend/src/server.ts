import { config } from './config';
import app from './app';
import logger from './lib/logger';
import { loadAccessMatrix } from './lib/permissions';

const PORT = config.port;

void loadAccessMatrix();

app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`, {
    env: config.nodeEnv,
    port: PORT,
  });
});
