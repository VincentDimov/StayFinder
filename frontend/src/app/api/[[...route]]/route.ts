import { Hono } from 'hono';
import { app } from '@stayfinder/backend/app';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;
const api = new Hono().route('/api', app);
const handler = (request: Request) => api.fetch(request);
export {
  handler as GET,
  handler as POST,
  handler as PUT,
  handler as PATCH,
  handler as DELETE,
  handler as OPTIONS,
  handler as HEAD,
};
