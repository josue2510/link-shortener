import express, { type Express } from 'express';
import morgan from 'morgan';
import linkRoutes from '@/routes/link.routes.js';
import { errorHandler } from '@/middleware/error-handler.js';
import { globalRateLimiter } from '@/middleware/rate-limiter.js';

const app: Express = express();

app.set('trust proxy', 1);

app.use(morgan('dev'));
app.use(express.json());
app.use(globalRateLimiter);

app.use('/api/links', linkRoutes);

app.use(errorHandler);

export default app;
