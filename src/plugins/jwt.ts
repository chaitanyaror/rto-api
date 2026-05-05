import fp from 'fastify-plugin';
import jwt from '@fastify/jwt';
import { FastifyRequest, FastifyReply } from 'fastify';

export default fp(async (fastify) => {
  fastify.register(jwt, {
    secret: process.env.JWT_SECRET!,
  });

  fastify.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
      (request as any).user = request.user;
    } catch (err) {
      reply.send(err);
    }
  });
});