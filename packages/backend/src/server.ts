import { config } from './config';
import app from './app';
import logger from './lib/logger';

const PORT = config.port;

app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`, {
    env: config.nodeEnv,
    port: PORT,
  });
});
