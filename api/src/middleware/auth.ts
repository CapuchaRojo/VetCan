import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';


export interface AuthRequest extends Request {
user?: any;
}


export const requireAuth = (req: AuthRequest, res: Response, next: NextFunction) => {
const auth = req.headers.authorization;
if (!auth) return res.status(401).json({ error: 'Missing auth' });


const token = auth.replace('Bearer ', '');
try {
const payload = jwt.verify(token, process.env.JWT_SECRET || 'changeme');
req.user = payload;
next();
} catch (err) {
return res.status(401).json({ error: 'Invalid token' });
}
};
