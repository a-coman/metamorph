import { Controller, Get, Header, Param } from '@nestjs/common';
import { MrVersionService } from '../../infrastructure/persistence/mr-version-prisma.query.js';

@Controller('mr-versions')
export class MrVersionsController {
  constructor(private readonly mrVersionService: MrVersionService) {}

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.mrVersionService.getById(id);
  }

  @Get(':id/playbook')
  @Header('Content-Type', 'text/plain; charset=utf-8')
  async getPlaybook(@Param('id') id: string) {
    const playbook = await this.mrVersionService.getPlaybook(id);
    return playbook.content;
  }
}
