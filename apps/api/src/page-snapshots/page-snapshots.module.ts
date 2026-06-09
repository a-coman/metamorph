import { Module } from '@nestjs/common';
import { GetPageSnapshotService } from './application/services/get-page-snapshot.service.js';
import { PageSnapshotsController } from './presentation/controllers/page-snapshots.controller.js';

@Module({
  controllers: [PageSnapshotsController],
  providers: [GetPageSnapshotService],
})
export class PageSnapshotsModule {}
