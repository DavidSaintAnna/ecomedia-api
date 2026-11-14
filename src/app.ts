import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';

export const app = express();

app.use(helmet());
app.use(cors({ origin: (process.env.CORS_ORIGIN ?? 'http://localhost:5173').split(',') }));
app.use(express.json());
app.use(morgan('dev'));

app.get('/', (_req, res) => {
  res.json({ name: 'EcoMedia API', health: '/api/health' });
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use((req, res) => {
  res.status(404).json({ error: 'NotFound', message: `Route ${req.method} ${req.path} not found` });
});


