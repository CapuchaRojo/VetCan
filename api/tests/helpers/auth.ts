import jwt from 'jsonwebtoken';
import { Test } from 'supertest';

/**
 * Generate a valid JWT token for testing
 * @param overrides - Optional payload overrides
 */
export function getTestToken(overrides?: {
  email?: string;
  role?: string;
  [key: string]: any;
}) {
  const payload = {
    email: 'test-admin@vetcan.local',
    role: 'admin',
    ...overrides
  };

  return jwt.sign(
    payload,
    process.env.JWT_SECRET || 'test-secret',
    { expiresIn: '1h' }
  );
}

/**
 * Add authentication header to supertest request
 * @param request - Supertest request object
 * @param token - Optional custom token (generates one if not provided)
 */
export function withAuth(request: Test, token?: string): Test {
  const authToken = token || getTestToken();
  return request.set('Authorization', `Bearer ${authToken}`);
}

/**
 * Bypass authentication for testing business logic
 * Only works in test environment with updated middleware
 * @param request - Supertest request object
 */
export function skipAuth(request: Test): Test {
  return request.set('x-test-skip-auth', 'true');
}

/**
 * Create tokens for different user roles
 */
export const testTokens = {
  admin: () => getTestToken({ role: 'admin', email: 'admin@vetcan.local' }),
  veterinarian: () => getTestToken({ role: 'veterinarian', email: 'vet@vetcan.local' }),
  staff: () => getTestToken({ role: 'staff', email: 'staff@vetcan.local' }),
  client: () => getTestToken({ role: 'client', email: 'client@vetcan.local' })
};

/**
 * Quick auth helpers for different roles
 */
export const authAs = {
  admin: (request: Test) => withAuth(request, testTokens.admin()),
  veterinarian: (request: Test) => withAuth(request, testTokens.veterinarian()),
  staff: (request: Test) => withAuth(request, testTokens.staff()),
  client: (request: Test) => withAuth(request, testTokens.client())
};
