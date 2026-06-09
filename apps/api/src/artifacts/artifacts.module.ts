import { Module } from '@nestjs/common';
import { GetArtifactUrlService } from './application/services/get-artifact-url.service.js';
import { ArtifactsController } from './presentation/controllers/artifacts.controller.js';

@Module({
  controllers: [ArtifactsController],
  providers: [GetArtifactUrlService],
})
export class ArtifactsModule {}
