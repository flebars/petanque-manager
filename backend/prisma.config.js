require('dotenv/config');

/** @type {import('prisma/config').PrismaConfig} */
module.exports = {
  schema: './prisma/schema.prisma',
  migrations: {
    path: './prisma/migrations',
  },
  datasource: {
    url: process.env.DATABASE_URL ?? '',
  },
};
