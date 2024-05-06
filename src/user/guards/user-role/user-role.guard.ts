import { BadRequestException, CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { META_ROLES } from '../../decorators/role-protected.decorator';

@Injectable()
export class UserRoleGuard implements CanActivate {

  constructor(
    private readonly reflector: Reflector,
  ) {}
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const validRoles: string[] = this.reflector.get<string[]>(META_ROLES, context.getHandler());
    const req = context.switchToHttp().getRequest();
    const user = req.user;

    if (!user) {
      throw new BadRequestException('User not found');
    }

    for (const role of user.roles) {
      // Check required roles for the endpoint if exists
      if (
        (validRoles.length > 0 && validRoles.includes(role)) || 
        (validRoles.length === 0)
      ) {
        return true;
      }
    }

    throw new ForbiddenException(`User ${user.email} need a valid role: [${validRoles}]`);
  }
}
