import { Controller, Get, Param } from '@nestjs/common';
import { GetPageSnapshotService } from '../../application/services/get-page-snapshot.service.js';

@Controller('page-snapshots')
export class PageSnapshotsController {
  constructor(private readonly getPageSnapshotService: GetPageSnapshotService) {}

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.getPageSnapshotService.getById(id);
  }
}
