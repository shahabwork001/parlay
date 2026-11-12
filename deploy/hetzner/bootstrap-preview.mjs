// Run through `compose.sh exec -T api node --input-type=module`.
import { MongoClient } from 'mongodb';
import { MongoSiteConfig } from './dist/infrastructure/site/mongo-site-config.js';
import { MongoTextRulesProvider } from './dist/infrastructure/moderation/text-rules-store.js';

const client = new MongoClient(process.env.MONGO_URI);
try {
  const db = client.db(process.env.MONGO_DATABASE);
  const site = new MongoSiteConfig(db);
  await site.ensureDefaults();
  const config = await site.current();
  await site.save({
    ...config,
    features: { ...config.features, registration: false },
    announcement: {
      message: 'Preview deployment. Account registration and email delivery are not yet available.',
      tone: 'info',
    },
    updatedAt: new Date(),
    updatedBy: 'deployment-bootstrap',
  });
  await new MongoTextRulesProvider(db).current();
  console.log('Preview settings and moderation rules ready; registration closed pending SMTP.');
} finally {
  await client.close();
}
