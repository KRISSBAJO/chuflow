import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from './decorators/public.decorator';

@ApiTags('Health')
@Controller()
export class AppController {
  @Public()
  @Get('health')
  getHealth() {
    const release = process.env.RENDER_GIT_COMMIT;
    return {
      status: 'ok',
      service: 'church-management-api',
      timestamp: new Date().toISOString(),
      ...(release && /^[a-f0-9]{40}$/i.test(release) ? { release } : {}),
    };
  }
}
