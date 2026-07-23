import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  getAuthenticateOptions(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();

    // Cleanly sets the OAuth2 state parameter per-request
    return {
      state: req.query.plan ? String(req.query.plan) : undefined,
    };
  }
}
