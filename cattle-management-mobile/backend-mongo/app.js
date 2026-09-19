const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');

const { errorHandler } = require('./middleware');

function requireApiKey(req, res, next) {
  const apiKey = process.env.API_KEY;

  if (process.env.NODE_ENV === 'test') {
    return next();
  }

  if (!apiKey) {
    return res.status(500).json({
      success: false,
      error: 'Server Misconfiguration',
      message: 'API_KEY is not configured.',
    });
  }

  const authHeader = req.get('Authorization') || '';
  const providedKey = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (providedKey !== apiKey) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'A valid bearer token is required.',
    });
  }

  return next();
}

/**
 * Builds the Express app. Kept separate from `server.js` so tests can mount it
 * with supertest without opening a port or connecting to a database.
 */
function createApp({ enableLogging = true } = {}) {
  const app = express();

  const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:19006,http://localhost:3000').split(',').map((entry) => entry.trim()).filter(Boolean);

  app.use(helmet());
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        return callback(new Error('Not allowed by CORS'));
      },
      credentials: true,
    })
  );

  // 100kb is ample for these JSON payloads; the previous 10mb limit only widened
  // the surface for memory-exhaustion attempts.
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: true, limit: '100kb' }));

  if (enableLogging && process.env.NODE_ENV !== 'test') {
    app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
  }

  // Health check is registered before the limiter so uptime probes and Render's
  // health checks can never be throttled.
  app.get('/api/health', (req, res) => {
    const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: states[mongoose.connection.readyState] || 'unknown',
      uptime_seconds: Math.round(process.uptime()),
    });
  });

  // A farm worker entering a day's records makes many small writes in a burst,
  // so 100 requests / 15 min was far too tight. Disabled entirely in tests.
  if (process.env.NODE_ENV !== 'test') {
    app.use(
      '/api',
      rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 1000,
        standardHeaders: true,
        legacyHeaders: false,
        message: {
          success: false,
          error: 'Too Many Requests',
          message: 'Rate limit exceeded, please retry shortly.',
        },
      })
    );
  }

  app.use('/api', requireApiKey);
  app.use('/api/cattle', require('./routes/cattle'));
  app.use('/api/milk', require('./routes/milk'));
  app.use('/api/feeding', require('./routes/feeding'));
  app.use('/api/financial', require('./routes/financial'));
  app.use('/api/analytics', require('./routes/analytics'));
  app.use('/api/settings', require('./routes/settings'));

  // 404 — must come after routes, before the error handler.
  app.use((req, res) => {
    res.status(404).json({
      success: false,
      error: 'Not Found',
      message: `Route ${req.method} ${req.originalUrl} does not exist`,
      timestamp: new Date().toISOString(),
    });
  });

  // Single centralized error handler for the whole API.
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
