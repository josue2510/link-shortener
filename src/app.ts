import express, { type Express } from 'express';
import morgan from 'morgan';
import linkRoutes from '@/routes/link.routes.js';
import { errorHandler } from '@/middleware/error-handler.js';

const app: Express = express();

app.use(morgan('dev'));
app.use(express.json());

app.use('/api/links', linkRoutes);

app.use(errorHandler);

export default app;
