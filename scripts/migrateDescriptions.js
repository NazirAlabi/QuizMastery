/* eslint-disable no-console */
import admin from 'firebase-admin';

const args = new Set(process.argv.slice(2));
const applyChanges = args.has('--apply');

const projectId =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.GCLOUD_PROJECT ||
    process.env.PROJECT_ID ||
    'quizmastery-4ef0e';

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId,
    });
}

const db = admin.firestore();

const migrateCollection = async (collectionName) => {
    console.log(`\nScanning ${collectionName} collection...`);
    const collectionRef = db.collection(collectionName);
    const snapshot = await collectionRef.get();

    let migratedCount = 0;

    for (const doc of snapshot.docs) {
        const data = doc.data() || {};

        // Check if description exists
        if (data.description !== undefined) {
            const shortDescription = String(data.shortDescription || data.description || '').trim();

            if (!applyChanges) {
                console.log(`[dry-run] Would update ${collectionName}/${doc.id}:`);
                console.log(`          - Set shortDescription to: "${shortDescription}"`);
                console.log(`          - Set longDescription to: ""`);
                console.log(`          - Delete description field`);
                continue;
            }

            await doc.ref.update({
                shortDescription: shortDescription,
                longDescription: '',
                description: admin.firestore.FieldValue.delete()
            });
            migratedCount++;
            console.log(`Migrated ${collectionName}/${doc.id}`);
        }
    }

    if (applyChanges) {
        console.log(`Migrated ${migratedCount} documents in ${collectionName}`);
    } else {
        console.log(`Dry run complete. Use --apply to migrate documents in ${collectionName}`);
    }
};

const run = async () => {
    if (!applyChanges) {
        console.log('Running in dry-run mode. Use --apply to execute changes.');
    }

    await migrateCollection('courses');
    await migrateCollection('quizzes');
};

run().catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
});
