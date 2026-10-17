import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { SCRAPE_QUEUE, ScraperService } from './scraper.service';

// Two pages at a time: polite to source sites and light on the server.
@Processor(SCRAPE_QUEUE, { concurrency: 2 })
export class ScrapeProcessor extends WorkerHost {
  constructor(private readonly scraper: ScraperService) {
    super();
  }

  async process(job: Job<{ id: string }>): Promise<void> {
    await this.scraper.process(job.data.id);
  }
}
