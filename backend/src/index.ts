import express, { Express, NextFunction, Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import { AddressInfo } from 'net';
import quizRoutes from './routes/quizRoutes';

const app: Express = express();
const defaultPort = Number(process.env.PORT) || 3000;

app.use(cors());
// Notes file upload is sent as base64 JSON; keep body limit above encoded 20 MB payload.
app.use(express.json({ limit: '35mb' }));
app.use('/uploads', express.static(path.resolve(__dirname, '..', 'uploads')));

app.get('/api', (req: Request, res: Response) => {
  res.send('Welcome to EduHub Backend!');
});

app.use('/api', quizRoutes);

app.use((error: unknown, req: Request, res: Response, next: NextFunction) => {
  const errorType =
    typeof error === 'object' && error !== null && 'type' in error
      ? String((error as { type?: unknown }).type ?? '')
      : '';

  if (errorType === 'entity.too.large') {
    return res.status(413).json({
      error: 'Uploaded file is too large. Maximum supported file size is 20 MB.',
    });
  }

  return next(error);
});

const startServer = (port: number) => {
  const server = app.listen(port, () => {
    const address = server.address() as AddressInfo | null;
    const activePort = address?.port ?? port;
    console.log(`Server is running at http://localhost:${activePort}`);
  });

  server.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') {
      const nextPort = port + 1;
      console.warn(`Port ${port} is in use, trying ${nextPort}...`);
      startServer(nextPort);
      return;
    }

    throw error;
  });
};

startServer(defaultPort);
