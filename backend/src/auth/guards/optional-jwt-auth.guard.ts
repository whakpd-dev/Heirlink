import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Опциональный JWT: при валидном токене подставляет req.user, при отсутствии/невалидном — не бросает ошибку.
 * Используется для эндпоинтов, которые работают и без авторизации (например, публичный профиль с isFollowing).
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser>(err: Error | null, user: TUser | false): TUser | null {
    if (err || !user) return null;
    return user;
  }
}
