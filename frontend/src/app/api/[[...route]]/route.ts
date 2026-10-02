import { Hono } from 'hono';
import { app } from '@stayfinder/backend/app';

// API:t körs i Node.js eftersom PostgreSQL-drivrutinen behöver Node-funktioner.
export const runtime = 'nodejs';
// Sessionsberoende API-svar ska hanteras för varje anrop och inte byggas som statiska svar.
export const dynamic = 'force-dynamic';
export const maxDuration = 30;
// Monterar samma Hono-API under /api så att frontend och backend delar Vercel-projekt och domän.
const api = new Hono().route('/api', app);
api.notFound((c) => c.json({ error: 'API-routen finns inte.', code: 'HTTP_404' }, 404));
const handler = (request: Request) => api.fetch(request);
// Skickar samtliga stödda HTTP-metoder till den gemensamma API-hanteraren.
export {
  handler as GET,
  handler as POST,
  handler as PUT,
  handler as PATCH,
  handler as DELETE,
  handler as OPTIONS,
  handler as HEAD,
};
