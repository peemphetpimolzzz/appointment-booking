import express, { Express } from 'express';
import { errorHandler } from './errors';
import { servicesRouter } from './routes/services';
import { businessHoursRouter } from './routes/business-hours';
import { availabilityRouter } from './routes/availability';
import { bookingsRouter } from './routes/bookings';

/**
 * Build the Express app without binding a port, so supertest can import it directly
 * and the entrypoint (`index.ts`) can own the `listen` call.
 *
 * Express 4 does not forward errors thrown by async handlers, so wrap every layer's
 * stack to funnel rejections into the terminal error middleware.
 */
export function createApp(): Express {
  const app = express();
  app.use(express.json({ limit: '256kb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api/services', wrapAsync(servicesRouter));
  app.use('/api/business-hours', wrapAsync(businessHoursRouter));
  app.use('/api/availability', wrapAsync(availabilityRouter));
  app.use('/api/bookings', wrapAsync(bookingsRouter));

  app.use(errorHandler);
  return app;
}

// Wrap each route handler so a rejected promise reaches Express' error middleware.
function wrapAsync(router: express.Router): express.Router {
  router.stack.forEach((layer) => {
    const route = (layer as unknown as { route?: { stack: Array<{ handle: express.Handler }> } })
      .route;
    if (!route) return;
    route.stack.forEach((s) => {
      const original = s.handle;
      s.handle = (req, res, next) => {
        try {
          const result = original(req, res, next) as unknown;
          if (result instanceof Promise) result.catch(next);
        } catch (err) {
          next(err);
        }
      };
    });
  });
  return router;
}
