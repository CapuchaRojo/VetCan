import jwt from 'jsonwebtoken';

export function getTestToken() {
  return jwt.sign(
    {
      email: 'test-admin@vetcan.local',
      role: 'admin'
    },
    process.env.JWT_SECRET || 'test-secret',
    { expiresIn: '1h' }
  );
}
