import { PermissionsModule } from '../permissions/permissions.module';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { MailModule } from '../mail/mail.module';
import { WorkspaceAccessService } from '../workspaces/workspace-access.service';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    ConfigModule,
    UsersModule,
    PermissionsModule,
    MailModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret:
          configService.get<string>('jwtSecret') ?? 'super-secret-change-me',
        signOptions: {
          expiresIn: (configService.get<string>('jwtExpiresIn') ??
            '1d') as never,
        },
      }),
    }),
  ],
  providers: [AuthService, JwtStrategy, WorkspaceAccessService],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
