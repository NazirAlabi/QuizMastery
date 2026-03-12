/* eslint-disable no-console */
import admin from 'firebase-admin';

const args = new Set(process.argv.slice(2));
const applyChanges = args.has('--apply');
const scanAll = args.has('--scan-all');

const now = new Date();
const cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
const cutoffTimestamp = admin.firestore.Timestamp.fromDate(cutoffDate);
const nowTimestamp = admin.firestore.Timestamp.fromDate(now);

const projectId =
  process.env.FIREBASE_PROJECT_ID ||
  process.env.GCLOUD_PROJECT ||
  process.env.PROJECT_ID ||
  undefined;

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId,
  });
}

const db = admin.firestore();
const usersCollection = db.collection('users');
const isWithinLastWeek = (data = {}) => {
  const createdAt = data.createdAt;
  if (!createdAt || typeof createdAt.toDate !== 'function') {
    return false;
  }

  const createdDate = createdAt.toDate();
  return createdDate >= cutoffDate && createdDate <= now;
};

const scanAllUsers = async () => {
  const recentIds = new Set();
  const snapshot = await usersCollection.get();
  snapshot.forEach((doc) => {
    const data = doc.data() || {};
    if (isWithinLastWeek(data)) {
      recentIds.add(doc.id);
    }
  });
  return recentIds;
};

const queryRecentUsers = async () => {
  const recentIds = new Set();
  const outcomes = await Promise.allSettled([
    usersCollection.where('createdAt', '>=', cutoffTimestamp).where('createdAt', '<=', nowTimestamp).get(),
  ]);

  let anySuccess = false;
  outcomes.forEach((result) => {
    if (result.status !== 'fulfilled') return;
    anySuccess = true;
    result.value.forEach((doc) => recentIds.add(doc.id));
  });

  return { recentIds, anySuccess };
};

const run = async () => {
  if (!applyChanges) {
    console.log('Running in dry-run mode. Use --apply to delete documents.');
  }
  console.log(
    `Target window (UTC): ${cutoffDate.toISOString()} -> ${now.toISOString()}`
  );

  let recentIds = new Set();

  if (scanAll) {
    recentIds = await scanAllUsers();
  } else {
    const { recentIds: queriedIds, anySuccess } = await queryRecentUsers();
    recentIds = queriedIds;

    if (!anySuccess) {
      console.warn('Recent user query failed. Falling back to full collection scan.');
      recentIds = await scanAllUsers();
    }
  }

  if (recentIds.size === 0) {
    console.log('No users created in the last 7 days found.');
    return;
  }

  console.log(`Found ${recentIds.size} user(s) created in the last 7 days.`);

  let deletedCount = 0;
  for (const userId of recentIds) {
    if (!applyChanges) {
      console.log(`[dry-run] Would delete users/${userId}`);
      continue;
    }

    await db.recursiveDelete(usersCollection.doc(userId));
    deletedCount += 1;
    console.log(`Deleted users/${userId}`);
  }

  if (applyChanges) {
    console.log(`Deleted ${deletedCount} user(s) created in the last 7 days.`);
  }
};

run().catch((error) => {
  console.error('Recent user cleanup failed:', error);
  process.exit(1);
});
