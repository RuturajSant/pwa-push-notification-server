import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import webPush from 'web-push';

const app = express();
// cors
app.use(cors());
app.use(bodyParser.json());

const VAPID_PUBLIC_KEY = 'BFNJlpgODlDPurDBxQB3eSqT1olGJpJ51V0PCQwZS6DAhQun6-hPfGu4eEgqw3rexhkAZ5kE5HriHruWW44w13c';
const VAPID_PRIVATE_KEY = 'HUMZPyIPb97fwcI8w18RHn_GXukDWieBSycT9yNoL04';

webPush.setVapidDetails(
  'mailto:sant.ruturaj2001@gmail.com',
  VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
);

// Persist subscriptions to subscription.json (array of subscription objects)
const SUBS_FILE = path.join(process.cwd(), 'subscription.json');

// Helper: read subscription.json and return an array. If the file doesn't exist or is invalid, return []
async function readSubscriptionsFile() {
    try {
        const raw = await fs.promises.readFile(SUBS_FILE, 'utf8');
        const parsed = JSON.parse(raw || '[]');
        if (Array.isArray(parsed)) return parsed;
        // If file contains an object (legacy), convert to array of values
        if (typeof parsed === 'object' && parsed !== null) return Object.values(parsed);
        return [];
    } catch (err) {
        // If file missing or invalid, return empty array
        return [];
    }
}

// Helper: write array to file atomically
async function writeSubscriptionsFile(arr) {
    const tempPath = SUBS_FILE + '.tmp';
    const data = JSON.stringify(arr, null, 2);
    await fs.promises.writeFile(tempPath, data, 'utf8');
    await fs.promises.rename(tempPath, SUBS_FILE);
}

// Receive subscription from client
app.post('/api/save-subscription', async (req, res) => {
    console.log('📩 Received subscription request', req.body);
    const { subscription } = req.body;

    if (!subscription || !subscription.endpoint) {
        return res.status(400).json({ error: 'Invalid subscription object' });
    }

    try {
        const subs = await readSubscriptionsFile();
        let email = "santruturaj"+Date.now() + "@gmail.com";
        // attach email if provided
        if (email) subscription.email = email;

        // Check uniqueness by email when available, otherwise by endpoint
        let exists = false;
        if (email) {
            exists = subs.some(s => s.email === email);
        } else if (subscription.endpoint) {
            exists = subs.some(s => s.endpoint === subscription.endpoint);
        }

        if (exists) {
            console.log('⚠️ Subscription already exists for', email || subscription.endpoint);
            return res.status(409).json({ message: 'Subscription already exists' });
        }

        // Insert new subscription into array
        subs.push(subscription);

        await writeSubscriptionsFile(subs);

        console.log('✅ Subscription inserted. Total subscriptions:', subs.length);
        return res.status(201).json({ message: 'Subscription saved' });
    } catch (err) {
        console.error('❌ Failed saving subscription', err);
        return res.status(500).json({ error: 'Failed to save subscription' });
    }
});

app.post('/send', async (req, res) => {
    const { email } = req.body;
  const payload = JSON.stringify({
    title: 'Hey there!',
    body: 'This is your push notification ??',
  });
    const subscriptions = await readSubscriptionsFile();
    let selectedSubs = subscriptions.filter(sub => sub.email === email);
    selectedSubs.forEach(sub => {
    webPush.sendNotification(sub, payload).catch(console.error);
  });
  res.status(200).json({ message: 'Notification sent' });
});

app.get('/health', async (req, res) => {
    const subs = await readSubscriptionsFile();
    console.log('Total subscriptions:', subs.length);
    res.status(200).send('Server is healthy');
});

app.listen(5000, () => {
    console.log('Server running on http://localhost:5000');
});
