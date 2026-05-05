import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { UserService } from './user.service.js';
import { EmailService } from './email.service.js';
import { PrismaClient, Role } from '../generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import Redis from 'redis';

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
const redis = Redis.createClient({ url: process.env.REDIS_URL });
redis.connect();

export class AuthService {
  private userService = new UserService();
  private emailService = new EmailService();

  async register(email: string, password: string, first_name: string, last_name: string, role?: Role) {
    const existingUser = await this.userService.findUserByEmail(email);
    if (existingUser) {
      throw new Error('User already exists');
    }

    const user = await this.userService.createUser(email, password, first_name, last_name, role);
    const accessToken = this.generateToken(user.id);
    const refreshToken = await this.generateRefreshToken(user.id);
    return { user, accessToken, refreshToken };
  }

  async login(email: string, password: string) {
    const user = await this.userService.findUserByEmail(email);
    if (!user) {
      throw new Error('Invalid credentials');
    }

    const isValid = await this.userService.validatePassword(password, user.password);
    if (!isValid) {
      throw new Error('Invalid credentials');
    }

    const accessToken = this.generateToken(user.id);
    const refreshToken = await this.generateRefreshToken(user.id);
    return { user, accessToken, refreshToken };
  }

  async logout(accessToken: string, refreshToken?: string) {
    const decoded: any = jwt.decode(accessToken);
    if (decoded?.exp) {
      const ttl = decoded.exp - Math.floor(Date.now() / 1000);
      if (ttl > 0) await redis.setEx(`blacklist:${accessToken}`, ttl, '1');
    }
    if (refreshToken) {
      const decodedRefresh: any = jwt.decode(refreshToken);
      if (decodedRefresh?.jti) {
        await redis.del(`refresh:${decodedRefresh.jti}`);
      }
    }
  }

  async refreshToken(token: string) {
    let decoded: { userId: string; jti: string };
    try {
      decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET!) as { userId: string; jti: string };
    } catch {
      throw new Error('Invalid refresh token');
    }

    const stored = await redis.get(`refresh:${decoded.jti}`);
    if (!stored) {
      throw new Error('Refresh token has been revoked');
    }

    // Rotate: invalidate used token, issue new pair
    await redis.del(`refresh:${decoded.jti}`);
    const accessToken = this.generateToken(decoded.userId);
    const newRefreshToken = await this.generateRefreshToken(decoded.userId);
    return { accessToken, refreshToken: newRefreshToken };
  }

  async forgotPassword(email: string) {
    const user = await this.userService.findUserByEmail(email);
    if (!user) {
      throw new Error('User not found');
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour

    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken, resetTokenExpiry },
    });

    await this.emailService.sendResetPasswordEmail(email, resetToken);
  }

  async resetPassword(token: string, newPassword: string) {
    const user = await prisma.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExpiry: {
          gt: new Date(),
        },
      },
    });

    if (!user) {
      throw new Error('Invalid or expired token');
    }

    await this.userService.updateUser(user.id, { password: newPassword });
    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken: null, resetTokenExpiry: null },
    });
  }

  private generateToken(userId: string): string {
    return jwt.sign({ userId }, process.env.JWT_SECRET!, { expiresIn: '1h' });
  }

  private async generateRefreshToken(userId: string): Promise<string> {
    const jti = crypto.randomUUID();
    const token = jwt.sign({ userId, jti }, process.env.JWT_REFRESH_SECRET!, { expiresIn: '7d' });
    await redis.setEx(`refresh:${jti}`, 7 * 24 * 60 * 60, userId);
    return token;
  }

  async verifyToken(token: string) {
    // Check if token is blacklisted
    const isBlacklisted = await redis.get(`blacklist:${token}`);
    if (isBlacklisted) {
      throw new Error('Token is blacklisted');
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
      return decoded.userId;
    } catch (error) {
      throw new Error('Invalid token');
    }
  }
}