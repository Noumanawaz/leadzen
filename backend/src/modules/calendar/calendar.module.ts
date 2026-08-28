import { Module } from '@nestjs/common';
import { FeatureFlagsModule } from '../feature-flags/feature-flags.module';
import { CalendarController } from './calendar.controller';

@Module({
  imports: [FeatureFlagsModule],
  controllers: [CalendarController],
})
export class CalendarModule {}
