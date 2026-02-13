/**
 * Security middleware configuration for FarmFlow backend.
 * Implements OWASP Top 10 protections:
 * - Content Security Policy (CSP)
 * - HTTP Strict Transport Security (HSTS)
 * - Rate limiting per endpoint
 * - Input sanitization
 * - Request size limits
 * - HTTP Parameter Pollution protection
 */
import { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import hpp from 'hpp';
import { config } from '../config';

/**
 * Helmet configuration with CSP headers.
 */
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'https://*.googleapis.com', 'https://*.firebaseapp.com'],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: config.isProduction ? [] : null,
    },
  },
  // HSTS: force HTTPS for 1 year, include subdomains
  strictTransportSecurity: config.isProduction
    ? {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      }
    : false,
  // Prevent MIME type sniffing
  xContentTypeOptions: true,
  // Prevent clickjacking
  frameguard: { action: 'deny' },
  // Disable X-Powered-By header
  hidePoweredBy: true,
  // Prevent XSS via referrer
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  // Cross-Origin policies
  crossOriginEmbedderPolicy: false, // Disabled for API server
  crossOriginOpenerPolicy: { policy: 'same-origin' },
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // Allow API responses
});

/**
 * General rate limiter: 100 requests per 15 minutes per IP.
 */
export const generalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: config.isProduction ? 100 : 1000, // More lenient in dev
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many requests, please try again later',
    code: 'RATE_LIMIT_EXCEEDED',
    statusCode: 429,
    timestamp: new Date().toISOString(),
  },
  keyGenerator: (req) => {
    return req.ip || req.socket.remoteAddress || 'unknown';
  },
});

/**
 * Strict rate limiter for authentication endpoints: 10 attempts per 15 minutes.
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: config.isProduction ? 10 : 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many authentication attempts, please try again later',
    code: 'AUTH_RATE_LIMIT_EXCEEDED',
    statusCode: 429,
    timestamp: new Date().toISOString(),
  },
  keyGenerator: (req) => {
    return req.ip || req.socket.remoteAddress || 'unknown';
  },
});

/**
 * HTTP Parameter Pollution protection.
 * Picks the last value for query parameters when duplicates exist.
 */
export const parameterPollutionProtection = hpp({
  whitelist: [
    // Allow array parameters in specific endpoints
    'status',
    'type',
    'siteId',
  ],
});

/**
 * Input sanitization middleware.
 * Removes dangerous patterns from request body, query, and params.
 */
export function inputSanitizer(req: Request, _res: Response, next: NextFunction) {
  // Sanitize body
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }

  // Sanitize query param values in-place (req.query is read-only in Express 4.22+)
  if (req.query && typeof req.query === 'object') {
    for (const key of Object.keys(req.query)) {
      // Skip prototype pollution attempts
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        delete req.query[key];
        continue;
      }
      const val = req.query[key];
      if (typeof val === 'string') {
        req.query[key] = sanitizeString(val);
      }
    }
  }

  next();
}

/**
 * Recursively sanitize an object by removing potential XSS and injection patterns.
 */
function sanitizeObject(obj: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    // Skip prototype pollution attempts
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      continue;
    }

    if (typeof value === 'string') {
      sanitized[key] = sanitizeString(value);
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map((item) => {
        if (typeof item === 'string') return sanitizeString(item);
        if (typeof item === 'object' && item !== null) return sanitizeObject(item as Record<string, unknown>);
        return item;
      });
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Sanitize a string by removing dangerous patterns.
 * Preserves normal text, special characters for business use.
 */
function sanitizeString(str: string): string {
  return str
    // Remove null bytes
    .replace(/\0/g, '')
    // Remove script tags
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Remove event handlers
    .replace(/\bon\w+\s*=\s*["'][^"']*["']/gi, '')
    // Remove javascript: protocol
    .replace(/javascript\s*:/gi, '')
    // Remove data: protocol in suspicious contexts
    .replace(/data\s*:\s*text\/html/gi, '')
    // Trim excessive whitespace
    .trim();
}

/**
 * Request timeout middleware.
 * Prevents slow loris attacks by timing out long-running requests.
 */
export function requestTimeout(timeoutMs: number = 30000) {
  return (req: Request, res: Response, next: NextFunction) => {
    const timer = setTimeout(() => {
      if (!res.headersSent) {
        res.status(408).json({
          success: false,
          error: 'Request timeout',
          code: 'REQUEST_TIMEOUT',
          statusCode: 408,
          timestamp: new Date().toISOString(),
        });
      }
    }, timeoutMs);

    res.on('finish', () => clearTimeout(timer));
    res.on('close', () => clearTimeout(timer));

    next();
  };
}

/**
 * Security response headers that should be set on every response.
 */
export function additionalSecurityHeaders(_req: Request, res: Response, next: NextFunction) {
  // Prevent caching of API responses with sensitive data
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  // Permissions policy — restrict browser features
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=()',
  );

  next();
}
