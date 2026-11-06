import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnsupportedMediaTypeException,
} from '@nestjs/common';

@Injectable()
export class JsonSubmissionGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<{
        method: string;
        headers: Record<string, string | undefined>;
      }>();
    if (request.method !== 'POST') return true;
    // Cookie-authenticated entry routes must not accept browser simple-form POSTs.
    // JSON requests require a CORS preflight from an untrusted origin.
    const mediaType = request.headers['content-type']
      ?.split(';', 1)[0]
      .trim()
      .toLowerCase();
    if (mediaType !== 'application/json') {
      throw new UnsupportedMediaTypeException(
        'Submit entries as application/json.',
      );
    }
    return true;
  }
}
