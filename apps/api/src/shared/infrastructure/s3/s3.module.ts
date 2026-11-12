import { Global, Module } from '@nestjs/common';
import { S3StorageService } from './s3-storage.service.js';

@Global()
@Module({
  providers: [S3StorageService],
  exports: [S3StorageService],
})
export class S3Module {}
