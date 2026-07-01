import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    username: string;
  };
}

/**
 * JWT认证中间件
 */
export function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: '未提供认证令牌' });
      return;
    }

    const token = authHeader.substring(7);
    
    const decoded = jwt.verify(token, JWT_SECRET) as {
      id: string;
      username: string;
    };
    
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: '无效的认证令牌' });
  }
}

/**
 * 生成JWT令牌
 */
export function generateToken(userId: string, username: string): string {
  return jwt.sign(
    { id: userId, username },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}
