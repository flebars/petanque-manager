const path = require('path');

/** @type {import('prisma/config').PrismaConfig} */
module.exports = {
  schema: path.join(__dirname, 'prisma/schema.prisma'),
  migrations: {
    path: path.join(__dirname, 'prisma/migrations'),
  },
  datasource: {
    url: process.env.DATABASE_URL ?? '',
  },
};
