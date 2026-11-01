import { execSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
import { seed } from '../../prisma/seed';

// Recrea la base de tests y carga el seed una vez antes de toda la corrida.
export default async function setup() {
  execSync('prisma db push --force-reset --skip-generate', { stdio: 'ignore', env: process.env });
  const prisma = new PrismaClient();
  await seed(prisma);
  await prisma.$disconnect();
}
