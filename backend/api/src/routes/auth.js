import bcrypt from 'bcrypt';
import { query } from '../db.js';
import { generateToken, invalidateToken } from '../middleware/auth.js';

/**
 * Register auth routes.
 * @param {import('fastify').FastifyInstance} fastify
 */
export default async function authRoutes(fastify) {
  // POST /api/auth/login — Authenticate and return JWT
  fastify.post('/api/auth/login', {
    config: {
      rateLimit: {
        max: 5,
        timeWindow: '1 minute'
      }
    },
    schema: {
      body: {
        type: 'object',
        required: ['username', 'password'],
        properties: {
          username: { type: 'string', minLength: 1 },
          password: { type: 'string', minLength: 1 },
        },
      },
    },
  }, async (request, reply) => {
    const { username, password } = request.body;

    try {
      const result = await query(
        'SELECT id, username, password_hash FROM users WHERE username = $1',
        [username]
      );

      if (result.rows.length === 0) {
        // Constant-time: still hash to prevent timing attacks
        await bcrypt.hash(password, 10);
        return reply.code(401).send({
          error: 'Unauthorized',
          message: 'Invalid username or password',
        });
      }

      const user = result.rows[0];
      const validPassword = await bcrypt.compare(password, user.password_hash);

      if (!validPassword) {
        return reply.code(401).send({
          error: 'Unauthorized',
          message: 'Invalid username or password',
        });
      }

      const token = generateToken({
        id: user.id,
        username: user.username,
      });

      reply.setCookie('token', token, {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
      });

      return reply.send({
        user: {
          id: user.id,
          username: user.username,
        },
      });
    } catch (err) {
      request.log.error(err);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Login failed',
      });
    }
  });

  // POST /api/auth/change-password — Change password (authenticated)
  fastify.post('/api/auth/change-password', {
    preHandler: [fastify.authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['currentPassword', 'newPassword'],
        properties: {
          currentPassword: { type: 'string', minLength: 1 },
          newPassword: { type: 'string', minLength: 8 },
        },
      },
    },
  }, async (request, reply) => {
    const { currentPassword, newPassword } = request.body;
    const userId = request.user.id;

    try {
      const result = await query(
        'SELECT password_hash FROM users WHERE id = $1',
        [userId]
      );

      if (result.rows.length === 0) {
        return reply.code(404).send({ error: 'User not found' });
      }

      const validPassword = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
      if (!validPassword) {
        return reply.code(401).send({
          error: 'Unauthorized',
          message: 'Current password is incorrect',
        });
      }

      const newHash = await bcrypt.hash(newPassword, 12);
      await query(
        'UPDATE users SET password_hash = $1 WHERE id = $2',
        [newHash, userId]
      );

      return reply.send({ message: 'Password changed successfully' });
    } catch (err) {
      request.log.error(err);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to change password',
      });
    }
  });

  // GET /api/auth/verify — Verify current token is valid
  fastify.get('/api/auth/verify', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    return reply.send({
      valid: true,
      user: request.user,
    });
  });

  // POST /api/auth/logout — Clear cookie
  fastify.post('/api/auth/logout', async (request, reply) => {
    if (request.cookies.token) {
      invalidateToken(request.cookies.token);
    }
    reply.clearCookie('token', { path: '/' });
    return reply.send({ message: 'Logged out successfully' });
  });
}
