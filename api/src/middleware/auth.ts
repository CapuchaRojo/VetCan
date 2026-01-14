import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const RAW_NODE_ENV = process.env.NODE_ENV ?? "development";

const IS_PROD = RAW_NODE_ENV === "production";
const IS_TEST = RAW_NODE_ENV === "test";
const IS_DEV = !IS_PROD && !IS_TEST;

const ALLOW_DEV_AUTH_BYPASS =
  process.env.ALLOW_DEV_AUTH_BYPASS === "true";

function resolveJwtSecret(): string | null {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  if (IS_TEST) return "test-secret";
  return null;
}

/**
 * Strict authentication middleware
 */
export default function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  /**
   * 🧪 Test-only bypass (always allowed for Jest)
   */
  if (
    IS_TEST &&
    req.headers["x-test-skip-auth"] === "true"
  ) {
    return next();
  }

  /**
   * 🧪 Dev-only bypass (explicit opt-in)
   */
  if (IS_DEV && ALLOW_DEV_AUTH_BYPASS) {
    return next();
  }

  /**
   * 🔒 Hard auth enforcement below
   */
  const secret = resolveJwtSecret();
  if (!secret) {
    console.error("[auth] JWT_SECRET missing");
    return res.status(500).json({ error: "Auth misconfigured" });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) {
    return res.status(401).json({ error: "Invalid token" });
  }

  try {
    const decoded = jwt.verify(token, secret);
    (req as any).user = decoded;

    const operatorId =
      typeof decoded === "object" && decoded !== null && "sub" in decoded
        ? String((decoded as any).sub)
        : undefined;

    const operatorRole =
      typeof decoded === "object" && decoded !== null && "role" in decoded
        ? String((decoded as any).role)
        : undefined;

    const operatorName =
      typeof decoded === "object" && decoded !== null && "name" in decoded
        ? String((decoded as any).name)
        : undefined;

    (req as any).operator = {
      id: operatorId,
      role: operatorRole,
      name: operatorName ?? "Unknown Operator",
    };

    return next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

/**
 * Optional authentication
 * - Never blocks request
 * - Attaches user if token is valid
 */
export function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  const secret = resolveJwtSecret();
  if (!secret) return next();

  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    try {
      const token = authHeader.slice("Bearer ".length).trim();
      const decoded = jwt.verify(token, secret);
      (req as any).user = decoded;
    } catch {
      // silent
    }
  }

  next();
}

/**
 * Role-based authorization
 */
export function requireRole(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;

    if (!user || !user.role) {
      return res.status(403).json({ error: "Forbidden: No role assigned" });
    }

    if (!allowedRoles.includes(user.role)) {
      return res.status(403).json({
        error: `Forbidden: Requires one of: ${allowedRoles.join(", ")}`,
      });
    }

    next();
  };
}
