import express from 'express';
import cors from 'cors';
import routes from './routes/index';

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, _res, next) => {
  const time = new Date().toLocaleTimeString();
  console.log(`[${time}] [ENGINE] ${req.method} ${req.url}`);
  next();
});

// API Routes
app.use('/api', routes);

app.listen(PORT, '0.0.0.0', () => {
  console.log('----------------------------------------------------');
  console.log(`⚡ CortexOS Neural Engine is running!`);
  console.log(`📡 API Base: http://localhost:${PORT}/api`);
  console.log(`🩺 Health Check: http://localhost:${PORT}/api/health`);
  console.log(`💻 System Info: http://localhost:${PORT}/api/system/info`);
  console.log('----------------------------------------------------');
});

export default app;
