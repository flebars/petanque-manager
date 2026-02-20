import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  Inject,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/prisma/prisma.service';
import { Redis } from 'ioredis';
import * as bcrypt from 'bcryptjs';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { Role } from '@prisma/client';
import { JwtPayload } from './strategies/jwt.strategy';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    @Inject('REDIS_CLIENT') private redis: Redis,
  ) {}

  async register(dto: RegisterDto): Promise<{ accessToken: string; refreshToken: string }> {
    const existing = await this.prisma.joueur.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email déjà utilisé');

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const joueur = await this.prisma.joueur.create({
      data: {
        email: dto.email,
        passwordHash,
        nom: dto.nom,
        prenom: dto.prenom,
        genre: dto.genre,
        role: dto.role ?? Role.SPECTATEUR,
      },
    });

    return this.generateTokens(joueur.id, joueur.email, joueur.role);
  }

  async login(dto: LoginDto): Promise<{ accessToken: string; refreshToken: string }> {
    const joueur = await this.prisma.joueur.findUnique({ where: { email: dto.email } });
    if (!joueur) throw new UnauthorizedException('Identifiants invalides');

    const valid = await bcrypt.compare(dto.password, joueur.passwordHash);
    if (!valid) throw new UnauthorizedException('Identifiants invalides');

    return this.generateTokens(joueur.id, joueur.email, joueur.role);
  }

  async refresh(
    userId: string,
    email: string,
    role: Role,
    refreshToken: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const stored = await this.redis.get(`refresh:${userId}`);
    if (!stored || stored !== refreshToken) {
      throw new UnauthorizedException('Token de rafraîchissement invalide');
    }
    await this.redis.del(`refresh:${userId}`);
    return this.generateTokens(userId, email, role);
  }

  async logout(userId: string): Promise<void> {
    await this.redis.del(`refresh:${userId}`);
  }

  private async generateTokens(
    sub: string,
    email: string,
    role: Role,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const payload: JwtPayload = { sub, email, role };

    const accessToken = this.jwt.sign(payload, {
      secret: this.config.get<string>('JWT_SECRET', 'changeme'),
      expiresIn: this.config.get<string>('JWT_EXPIRES_IN', '15m'),
    });

    const refreshToken = this.jwt.sign(payload, {
      secret: this.config.get<string>('JWT_REFRESH_SECRET', 'changeme_refresh'),
      expiresIn: this.config.get<string>('JWT_REFRESH_EXPIRES_IN', '7d'),
    });

    const ttl = 7 * 24 * 60 * 60;
    await this.redis.set(`refresh:${sub}`, refreshToken, 'EX', ttl);

    return { accessToken, refreshToken };
  }
}
