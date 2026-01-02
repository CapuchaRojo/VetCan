import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

/**
 * Main auth middleware
 * Used by routes that require authentication
 */
export default function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  // ✅ Allow tests to selectively bypass auth via header
  if (process.env.NODE_ENV === 'test' && req.headers['x-test-skip-auth'] === 'true') {
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  try {
    // Verify the JWT token
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'test-secret'
    );
    
    // Attach user info to request for downstream use
    (req as any).user = decoded;
    
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

/**
 * Optional named export if needed elsewhere
 */
export function optionalAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.replace('Bearer ', '');
    try {
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || 'test-secret'
      );
      (req as any).user = decoded;
    } catch (error) {
      // Silently fail for optional auth
    }
  }
  
  next();
}

/**
 * Role-based authorization middleware
 * Use after requireAuth
 */
export function requireRole(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    
    if (!user || !user.role) {
      return res.status(403).json({ error: 'Forbidden: No role assigned' });
    }
    
    if (!allowedRoles.includes(user.role)) {
      return res.status(403).json({ 
        error: `Forbidden: Requires one of: ${allowedRoles.join(', ')}` 
      });
    }
    
    next();
  };
}
