import fp from 'fastify-plugin';
import redis from '@fastify/redis';

export default fp(async (fastify) => {
  fastify.register(redis, {
    url: process.env.REDIS_URL,
  });
});