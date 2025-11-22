import 'dotenv/config';
import { createAppContainer } from '../api/src/container';

async function main() {
  console.log('Starting interest accrual job...');
  
  const container = createAppContainer();
  const { savingsInvestmentPositionRepository } = container.repositories;
  const { savingsInvestmentService } = container.services;

  try {
    const userIds = await savingsInvestmentPositionRepository.findAllUserIds();
    console.log(`Found ${userIds.length} users with investment positions.`);

    let processed = 0;
    let errors = 0;

    for (const userId of userIds) {
      try {
        // getSummary triggers accrual
        await savingsInvestmentService.getSummary(userId);
        processed++;
        if (processed % 10 === 0) {
          console.log(`Processed ${processed}/${userIds.length} users...`);
        }
      } catch (error) {
        console.error(`Failed to accrue interest for user ${userId}:`, error);
        errors++;
      }
    }

    console.log(`Job completed. Processed: ${processed}, Errors: ${errors}`);
  } catch (error) {
    console.error('Fatal error in accrual job:', error);
    process.exit(1);
  }
}

main();
