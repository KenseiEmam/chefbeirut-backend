import cron from 'node-cron'
import { expirePlansJob } from './workers/expirePlans.worker'

// Every day at 00:10
cron.schedule('10 0 * * *', async () => {
  console.log('[CRON] Running plan expiration job')
  await expirePlansJob()
})
