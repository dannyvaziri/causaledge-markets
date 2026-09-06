import { authorizedUser } from '../../../../lib/access.js';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const user = authorizedUser(request);
  return Response.json({ authenticated: Boolean(user), user: user ? {
    id: user.id,
    email: user.email,
    name: user.name,
    picture: user.picture,
    provider: user.provider,
  } : null });
}
