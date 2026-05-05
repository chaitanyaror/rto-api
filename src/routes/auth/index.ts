import { FastifyPluginAsync } from 'fastify';
import { ZodError } from 'zod';
import { AuthService } from '../../services/auth.service.js';
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  refreshTokenSchema,
  RegisterBody,
  LoginBody,
  ForgotPasswordBody,
  ResetPasswordBody,
  RefreshTokenBody,
} from './schemas.js';

const authService = new AuthService();

function formatZodError(error: ZodError) {
  return error.issues.map((e) => ({ field: e.path.join('.'), message: e.message }));
}

const authRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/register', async (request, reply) => {
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(422).send({ errors: formatZodError(parsed.error) });
    }
    const { email, password, first_name, last_name, role }: RegisterBody = parsed.data;
    try {
      const result = await authService.register(email, password, first_name, last_name, role);
      reply.code(201).send(result);
    } catch (error: any) {
      reply.code(400).send({ error: error.message });
    }
  });

  fastify.post('/login', async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(422).send({ errors: formatZodError(parsed.error) });
    }
    const { email, password }: LoginBody = parsed.data;
    
    try {
      const result = await authService.login(email, password);
      reply.send(result);
    } catch (error: any) {
      reply.code(400).send({ error: error.message });
    }
  });

  fastify.post('/logout', async (request, reply) => {
    const accessToken = request.headers.authorization?.replace('Bearer ', '');
    if (!accessToken) {
      return reply.code(401).send({ error: 'No token provided' });
    }
    const { refreshToken } = (request.body as any) ?? {};
    try {
      await authService.logout(accessToken, refreshToken);
      reply.send({ message: 'Logged out' });
    } catch (error: any) {
      reply.code(400).send({ error: error.message });
    }
  });

  fastify.post('/refresh-token', async (request, reply) => {
    const parsed = refreshTokenSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(422).send({ errors: formatZodError(parsed.error) });
    }
    const { refreshToken }: RefreshTokenBody = parsed.data;
    try {
      const result = await authService.refreshToken(refreshToken);
      reply.send(result);
    } catch (error: any) {
      reply.code(401).send({ error: error.message });
    }
  });

  fastify.post('/forgot-password', async (request, reply) => {
    const parsed = forgotPasswordSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(422).send({ errors: formatZodError(parsed.error) });
    }
    const { email }: ForgotPasswordBody = parsed.data;
    try {
      await authService.forgotPassword(email);
      reply.send({ message: 'Reset email sent' });
    } catch (error: any) {
      reply.code(400).send({ error: error.message });
    }
  });

  fastify.post('/reset-password', async (request, reply) => {
    const parsed = resetPasswordSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(422).send({ errors: formatZodError(parsed.error) });
    }
    const { token, newPassword }: ResetPasswordBody = parsed.data;
    try {
      await authService.resetPassword(token, newPassword);
      reply.send({ message: 'Password reset successful' });
    } catch (error: any) {
      reply.code(400).send({ error: error.message });
    }
  });

  fastify.get('/me', {
    preHandler: (fastify as any).authenticate,
  }, async (request, reply) => {
    const userId = (request as any).user.userId;
    reply.send({ userId });
  });
};

export default authRoutes;
