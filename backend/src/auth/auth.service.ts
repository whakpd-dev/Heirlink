import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async register(registerDto: RegisterDto) {
    const { email, username, password } = registerDto;

    // Проверка существования пользователя
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [{ email }, { username }],
      },
    });

    if (existingUser) {
      throw new ConflictException('User with this email or username already exists');
    }

    // Хеширование пароля
    const passwordHash = await bcrypt.hash(password, 10);

    // Создание пользователя
    const user = await this.prisma.user.create({
      data: {
        email,
        username,
        passwordHash,
      },
    });

    // Генерация токенов
    const tokens = await this.generateTokens(user.id);

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        avatarUrl: user.avatarUrl,
        bio: user.bio,
      },
    };
  }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    // Поиск пользователя
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Проверка пароля
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Генерация токенов
    const tokens = await this.generateTokens(user.id);

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        avatarUrl: user.avatarUrl,
        bio: user.bio,
      },
    };
  }

  async refreshToken(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get('JWT_REFRESH_SECRET'),
      });

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      const tokens = await this.generateTokens(user.id);

      return {
        ...tokens,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          avatarUrl: user.avatarUrl,
          bio: user.bio,
        },
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private async generateTokens(userId: string) {
    const payload = { sub: userId };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get('JWT_SECRET'),
        expiresIn: this.configService.get('JWT_EXPIRES_IN') || '7d',
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.get('JWT_REFRESH_EXPIRES_IN') || '30d',
      }),
    ]);

    return { accessToken, refreshToken };
  }

  async validateUser(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        avatarUrl: true,
        bio: true,
        createdAt: true,
      },
    });
  }

  async getMe(userId: string) {
    const user = await this.validateUser(userId);
    if (!user) throw new UnauthorizedException('User not found');
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
    };
  }

  private resetCodes = new Map<string, { code: string; expiresAt: number; userId: string }>();

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) return { message: 'If the email exists, a reset code has been sent' };

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    this.resetCodes.set(email, { code, expiresAt: Date.now() + 15 * 60 * 1000, userId: user.id });

    // TODO: Send email with code via email service
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[Auth] Password reset code for ${email}: ${code}`);
    }

    return { message: 'If the email exists, a reset code has been sent' };
  }

  async resetPassword(email: string, code: string, newPassword: string) {
    const entry = this.resetCodes.get(email);
    if (!entry || entry.code !== code || Date.now() > entry.expiresAt) {
      throw new UnauthorizedException('Invalid or expired reset code');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: entry.userId },
      data: { passwordHash },
    });

    this.resetCodes.delete(email);
    return { message: 'Password reset successfully' };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('User not found');

    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) throw new UnauthorizedException('Current password is incorrect');

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
    return { message: 'Password changed successfully' };
  }
}
