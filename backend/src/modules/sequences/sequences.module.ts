import { Module } from '@nestjs/common';
import { OutreachModule } from '../outreach/outreach.module';
import { SequenceQueueService } from './sequence-queue.service';
import { SequenceRunnerService } from './sequence-runner.service';
import { SequencesController } from './sequences.controller';
import { SequencesService } from './sequences.service';

@Module({
  imports: [OutreachModule],
  controllers: [SequencesController],
  providers: [SequencesService, SequenceRunnerService, SequenceQueueService],
  exports: [SequencesService, SequenceRunnerService],
})
export class SequencesModule {}
