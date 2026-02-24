import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

const mockUser = {
  id: 'user-1',
  email: 'test@test.com',
  username: 'testuser',
  passwordHash: '',
  avatarUrl: null,
  bio: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('AuthService', () => {
  let service: AuthService;
  let prisma: { user: { findFirst: jest.Mock; findUnique: jest.Mock; create: jest.Mock; update: jest.Mock } };
  let jwtService: { signAsync: jest.Mock; verify: jest.Mock };
  let cacheService: { get: jest.Mock; set: jest.Mock; del: jest.Mock };

  beforeEach(async () => {
    mockUser.passwordHash = await bcrypt.hash('password123', 10);

    prisma = {
      user: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    jwtService = {
      signAsync: jest.fn().mockResolvedValue('mock-token'),
      verify: jest.fn(),
    };

    cacheService = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      del: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: { get: (key: string) => key === 'JWT_SECRET' ? 'secret' : 'refresh-secret' } },
        { provide: CacheService, useValue: cacheService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('register', () => {
    it('should register a new user', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(mockUser);

      const result = await service.register({
        email: 'test@test.com',
        username: 'testuser',
        password: 'password123',
      });

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.user.email).toBe('test@test.com');
    });

    it('should throw ConflictException if user exists', async () => {
      prisma.user.findFirst.mockResolvedValue(mockUser);

      await expect(
        service.register({ email: 'test@test.com', username: 'testuser', password: 'password123' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    it('should login with valid credentials', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.login({ email: 'test@test.com', password: 'password123' });
      expect(result).toHaveProperty('accessToken');
      expect(result.user.email).toBe('test@test.com');
    });

    it('should throw UnauthorizedException with invalid email', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({ email: 'wrong@test.com', password: 'password123' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException with invalid password', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);

      await expect(
        service.login({ email: 'test@test.com', password: 'wrongpassword' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refreshToken', () => {
    it('should reject blacklisted tokens', async () => {
      cacheService.get.mockResolvedValue(true);

      await expect(service.refreshToken('blacklisted-token')).rejects.toThrow(UnauthorizedException);
    });

    it('should blacklist old token on refresh', async () => {
      jwtService.verify.mockReturnValue({ sub: 'user-1' });
      prisma.user.findUnique.mockResolvedValue(mockUser);

      await service.refreshToken('valid-token');
      expect(cacheService.set).toHaveBeenCalledWith('bl:rt:valid-token', true, expect.any(Number));
    });
  });

  describe('forgotPassword', () => {
    it('should return same message for existing and non-existing users', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      const result1 = await service.forgotPassword('nonexistent@test.com');

      prisma.user.findUnique.mockResolvedValue(mockUser);
      const result2 = await service.forgotPassword('test@test.com');

      expect(result1.message).toBe(result2.message);
    });

    it('should store reset code in cache', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      await service.forgotPassword('test@test.com');

      expect(cacheService.set).toHaveBeenCalledWith(
        'reset:test@test.com',
        expect.objectContaining({ code: expect.any(String), userId: 'user-1' }),
        expect.any(Number),
      );
    });
  });
});
