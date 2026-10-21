import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import {
  JobsService,
  STALE_ORDER_QUEUE,
  ANOMALY_QUEUE,
  ETA_QUEUE,
  RIDER_PRESENCE_QUEUE,
} from './jobs.service';

// One processor class per queue: stacking several @Processor decorators on a
// single class only registers one worker.

@Processor(STALE_ORDER_QUEUE, { concurrency: 5 })
export class StaleOrderProcessor extends WorkerHost {
  constructor(private readonly jobsService: JobsService) {
    super();
  }

  async process(job: Job): Promise<any> {
    return this.jobsService.process(job);
  }
}

@Processor(ANOMALY_QUEUE, { concurrency: 5 })
export class AnomalyCheckProcessor extends WorkerHost {
  constructor(private readonly jobsService: JobsService) {
    super();
  }

  async process(job: Job): Promise<any> {
    return this.jobsService.process(job);
  }
}

@Processor(ETA_QUEUE, { concurrency: 5 })
export class EtaRecalculationProcessor extends WorkerHost {
  constructor(private readonly jobsService: JobsService) {
    super();
  }

  async process(job: Job): Promise<any> {
    return this.jobsService.process(job);
  }
}

// One at a time: the sweep reads then updates riders and orders.
@Processor(RIDER_PRESENCE_QUEUE, { concurrency: 1 })
export class RiderPresenceProcessor extends WorkerHost {
  constructor(private readonly jobsService: JobsService) {
    super();
  }

  async process(job: Job): Promise<any> {
    return this.jobsService.process(job);
  }
}
