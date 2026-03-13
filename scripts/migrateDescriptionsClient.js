/* eslint-disable no-console */
import { initializeApp } from 'firebase/app';
import {
    getFirestore,
    collection,
    getDocs,
    doc,
    updateDoc,
    deleteField
} from 'firebase/firestore';
import {
    getAuth,
    signInWithEmailAndPassword
} from 'firebase/auth';

const args = new Set(process.argv.slice(2));
const applyChanges = args.has('--apply');

const firebaseConfig = {
    apiKey: "AIzaSyDVARo-HWK6Tf-3k3PDIiqInXvZ1-5LZe8",
    authDomain: "quizmastery-4ef0e.firebaseapp.com",
    projectId: "quizmastery-4ef0e",
    storageBucket: "quizmastery-4ef0e.firebasestorage.app",
    messagingSenderId: "436197965034",
    appId: "1:436197965034:web:609c1960704272bb6feb93",
    measurementId: "G-DEZ4QTE3N6"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const migrateCollection = async (collectionName) => {
    console.log(`\nScanning ${collectionName} collection...`);
    const collectionRef = collection(db, collectionName);
    const snapshot = await getDocs(collectionRef);

    let migratedCount = 0;

    for (const document of snapshot.docs) {
        const data = document.data() || {};

        // Check if description exists
        if (data.description !== undefined) {
            const shortDescription = String(data.shortDescription || data.description || '').trim();

            if (!applyChanges) {
                console.log(`[dry-run] Would update ${collectionName}/${document.id}:`);
                console.log(`          - Set shortDescription to: "${shortDescription}"`);
                console.log(`          - Set longDescription to: ""`);
                console.log(`          - Delete description field`);
                continue;
            }

            await updateDoc(doc(db, collectionName, document.id), {
                shortDescription: shortDescription,
                longDescription: '',
                description: deleteField()
            });
            migratedCount++;
            console.log(`Migrated ${collectionName}/${document.id}`);
        }
    }

    if (applyChanges) {
        console.log(`Migrated ${migratedCount} documents in ${collectionName}`);
    } else {
        console.log(`Dry run complete. Use --apply to migrate documents in ${collectionName}`);
    }
};

const run = async () => {
    // Sign in as admin to bypass security rules
    await signInWithEmailAndPassword(auth, "demo@university.edu", "demo123");
    console.log('Signed in as demo user');

    if (!applyChanges) {
        console.log('Running in dry-run mode. Use --apply to execute changes.');
    }

    await migrateCollection('courses');
    await migrateCollection('quizzes');

    process.exit(0);
};

run().catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
});
