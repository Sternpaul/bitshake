import jwt from 'jsonwebtoken';

// In-memory blacklist for invalidated tokens
const tokenBlacklist = new Set();

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';

/**
 * Fastify preHandler hook that verifies JWT bearer tokens.
 * Attaches decoded user to request.user.
 */
export async function verifyToken(request, reply) {
  let token = request.cookies.token;

  if (!token) {
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
  }

  if (!token) {
    return reply.code(401).send({
      error: 'Unauthorized',
      message: 'Missing or invalid token',
    });
  }

  if (tokenBlacklist.has(token)) {
    return reply.code(401).send({
      error: 'Unauthorized',
      message: 'Token has been invalidated',
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    request.user = decoded;
  } catch (err) {
    return reply.code(401).send({
      error: 'Unauthorized',
      message: 'Invalid or expired token',
    });
  }
}

/**
 * Generate a JWT for a given user.
 * @param {object} payload - User data to encode
 * @returns {string} JWT token
 */
export function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });
}

/**
 * Add a token to the blacklist
 * @param {string} token 
 */
export function invalidateToken(token) {
  if (token) {
    tokenBlacklist.add(token);
    
    // Periodically clean up the set to prevent memory leaks? 
    // In a production environment with Redis, we'd set an expiry. 
    // Here we'll just let it grow slightly since it's low traffic.
  }
}
