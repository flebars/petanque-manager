const path = require('path');

/** @type {import('prisma/config').PrismaConfig} */
module.exports = {
  schema: path.join(__dirname, 'prisma/schema.prisma'),
  datasource: {
    url: process.env.DATABASE_URL ?? '',
  },
};
