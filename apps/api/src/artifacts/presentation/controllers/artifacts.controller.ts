import { Controller, Get, Param } from '@nestjs/common';
import { GetArtifactUrlService } from '../../application/services/get-artifact-url.service.js';

@Controller('artifacts')
export class ArtifactsController {
  constructor(private readonly getArtifactUrlService: GetArtifactUrlService) {}

  @Get(':id/url')
  getUrl(@Param('id') id: string) {
    return this.getArtifactUrlService.getUrl(id);
  }
}
