import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { config } from './config';
import { requestLogger } from './middleware/requestLogger';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import {
  securityHeaders,
  generalRateLimiter,
  authRateLimiter,
  parameterPollutionProtection,
  inputSanitizer,
  requestTimeout,
  additionalSecurityHeaders,
} from './middleware/security';
import { healthCheckHandler, metricsCollector } from './middleware/monitoring';
import routes from './routes';

const app = express();

// Trust proxy for rate limiting behind load balancers
if (config.isProduction) {
  app.set('trust proxy', 1);
}

// Security headers (Helmet with CSP, HSTS, etc.)
app.use(securityHeaders);
app.use(additionalSecurityHeaders);

// CORS configuration
app.use(
  cors({
    origin: config.corsOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
    maxAge: 86400, // Cache preflight for 24 hours
  }),
);

// General rate limiting
app.use(generalRateLimiter);

// Body parsing with size limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// HTTP parameter pollution protection
app.use(parameterPollutionProtection);

// Input sanitization (XSS, prototype pollution)
app.use(inputSanitizer);

// Request timeout (30 seconds)
app.use(requestTimeout(30000));

// Metrics collection
app.use(metricsCollector);

// Logging
app.use(requestLogger);

// Stricter rate limiting on auth routes
app.use('/api/auth', authRateLimiter);

// Routes
app.use('/api', routes);

// Also mount health check at root for load balancer
app.get('/health', healthCheckHandler);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
