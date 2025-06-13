import type { NextApiRequest, NextApiResponse } from 'next';
import { LemonSqueezy } from '@lemonsqueezy/lemonsqueezy.js';
import { clerkClient } from '@clerk/nextjs/server';
import crypto from 'crypto';

// Define the expected structure of the custom_data from Lemon Squeezy
interface LemonSqueezyCustomData {
  userId?: string;
  [key: string]: any; // Allow other properties
}

// Define the structure for subscription data to be stored in Clerk metadata
interface ClerkSubscriptionMetadata {
  lemonSqueezySubscription?: {
    status?: string | null;
    subscriptionId?: string | null;
    orderId?: string | null;
    productId?: string | null;
    variantId?: string | null;
    renewsAt?: string | null;
    endsAt?: string | null;
    trialEndsAt?: string | null;
    [key: string]: any; // Allow other relevant details
  } | null; // Allow clearing the subscription
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Ensure this is a POST request
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }

  // Get the Lemon Squeezy API Key, Store ID, and Webhook Secret from environment variables
  const lemonsqueezyApiKey = process.env.LEMONSQUEEZY_API_KEY;
  const lemonsqueezyStoreId = process.env.LEMONSQUEEZY_STORE_ID;
  const lemonsqueezyWebhookSecret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;

  if (!lemonsqueezyApiKey || !lemonsqueezyStoreId || !lemonsqueezyWebhookSecret) {
    console.error('Lemon Squeezy API Key, Store ID, or Webhook Secret is not set in environment variables.');
    return res.status(500).json({ message: 'Server configuration error.' });
  }

  // Initialize Lemon Squeezy client
  // Note: The new LemonSqueezy(apiKey) syntax is for v2 of the lemonsqueezy.js library.
  // Based on package.json, v4.0.0 is installed.
  // For v4.0.0, the setup is typically done globally or by passing the key directly to methods.
  // However, the library itself doesn't seem to have a client constructor that takes the store ID.
  // We will rely on the API key for authentication and the store ID might be used in specific API calls if needed.
  // The library seems to auto-configure with `process.env.LEMONSQUEEZY_API_KEY`.
  // For webhook verification, we don't need the client but the secret.

  try {
    // Verify the webhook signature
    const rawBody = await getRawBody(req);
    const signature = req.headers['x-signature'] as string;

    if (!signature) {
      console.warn('Webhook signature missing.');
      return res.status(400).json({ message: 'Signature missing.' });
    }

    const hmac = crypto.createHmac('sha256', lemonsqueezyWebhookSecret);
    const digest = Buffer.from(hmac.update(rawBody).digest('hex'), 'utf8');
    const signatureBuffer = Buffer.from(signature, 'utf8');

    if (!crypto.timingSafeEqual(digest, signatureBuffer)) {
      console.warn('Invalid webhook signature.');
      return res.status(401).json({ message: 'Invalid signature.' });
    }

    // Parse the webhook payload
    const payload = JSON.parse(rawBody);
    const eventName = payload.meta?.event_name;
    const customData = payload.meta?.custom_data as LemonSqueezyCustomData | undefined;
    const userId = customData?.userId;
    const subscriptionData = payload.data?.attributes;

    console.log(`Received Lemon Squeezy webhook: ${eventName}`, { userId, subscriptionId: payload.data?.id });

    if (!userId) {
      console.warn(`User ID not found in webhook meta.custom_data for event: ${eventName}`, payload.meta);
      // We still return 200 to acknowledge receipt to Lemon Squeezy, but log the issue.
      return res.status(200).json({ message: 'Webhook received, but user ID missing in custom_data.' });
    }

    let metadataUpdate: ClerkSubscriptionMetadata = {};

    switch (eventName) {
      case 'subscription_created':
      case 'subscription_updated':
        console.log(`Processing ${eventName} for user ${userId}`);
        metadataUpdate = {
          lemonSqueezySubscription: {
            status: subscriptionData?.status,
            subscriptionId: payload.data?.id,
            orderId: subscriptionData?.order_id?.toString(),
            productId: subscriptionData?.product_id?.toString(),
            variantId: subscriptionData?.variant_id?.toString(),
            renewsAt: subscriptionData?.renews_at,
            endsAt: subscriptionData?.ends_at,
            trialEndsAt: subscriptionData?.trial_ends_at,
            customerPortalUpdateUrl: subscriptionData?.urls?.update_payment_method, // Example: customer portal URL
            customerPortalUrl: subscriptionData?.urls?.customer_portal,
          },
        };
        break;

      case 'subscription_cancelled': // Covers expired, unpaid, cancelled
        console.log(`Processing ${eventName} for user ${userId}`);
        // Update status and ends_at, keep other details for history or clear them as preferred
        metadataUpdate = {
          lemonSqueezySubscription: {
            // Keep existing data but update status and ends_at
            // Or fetch existing metadata and merge, for now, we'll overwrite with latest event data.
            status: subscriptionData?.status,
            subscriptionId: payload.data?.id,
            orderId: subscriptionData?.order_id?.toString(),
            productId: subscriptionData?.product_id?.toString(),
            variantId: subscriptionData?.variant_id?.toString(),
            renewsAt: subscriptionData?.renews_at, // Should be null or past
            endsAt: subscriptionData?.ends_at,     // This is the key field for cancellation
            trialEndsAt: subscriptionData?.trial_ends_at, // Should be past
          },
        };

        // If you want to completely remove the subscription details upon cancellation:
        // metadataUpdate = { lemonSqueezySubscription: null };
        break;

      // Optional: Handle subscription_payment_failed, subscription_paused, subscription_resumed, etc.
      // case 'subscription_payment_failed':
      //   console.log(`Subscription payment failed for user ${userId}`);
      //   metadataUpdate = {
      //     lemonSqueezySubscription: {
      //       status: 'payment_failed', // Or use actual status from LS
      //       // ... other relevant fields
      //     },
      //   };
      //   break;

      default:
        console.log(`Unhandled Lemon Squeezy webhook event: ${eventName}`);
        return res.status(200).json({ message: `Webhook received, but event ${eventName} not handled.` });
    }

    // Update user metadata in Clerk
    if (Object.keys(metadataUpdate).length > 0) {
      await clerkClient.users.updateUserMetadata(userId, {
        publicMetadata: metadataUpdate,
      });
      console.log(`Successfully updated Clerk user ${userId} public metadata for event ${eventName}.`);
    }

    res.status(200).json({ message: 'Webhook processed successfully.' });

  } catch (error: any) {
    console.error('Error processing Lemon Squeezy webhook:', error);
    // Check if the error is due to rawBody parsing or other issues
    if (error.type === 'entity.parse.failed') {
        return res.status(400).json({ message: 'Invalid request body.' });
    }
    res.status(500).json({ message: `Internal Server Error: ${error.message}` });
  }
}

// Helper function to get raw body from NextApiRequest
// Next.js 12+ has built-in body parsing, but for webhook signature verification,
// we need the raw, unparsed body.
async function getRawBody(req: NextApiRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    if (req.body && Object.keys(req.body).length !== 0 && !req.headers['x-signature']) {
        // If body is already parsed and it's not a signature verification path, something is wrong.
        // For signature path, body might be parsed by Next.js if content-type is application/json.
        // We need to disable body parsing for this route for raw body.
        console.warn("Request body already parsed. For webhook signature verification, ensure body parsing is disabled or handle accordingly.");
    }

    // If body parsing is disabled for this route, req.body will be null or undefined.
    // If it's enabled, req.body will be the parsed object.
    // We need the raw string/buffer.

    // Check if body is already a buffer (e.g., if custom bodyParser: false is set)
    // This is unlikely by default.
    if (Buffer.isBuffer(req.body)) {
        return resolve(req.body);
    }

    // If body is a string (less likely for JSON, but possible for other types)
    if (typeof req.body === 'string') {
        return resolve(Buffer.from(req.body, 'utf8'));
    }

    // If body is already parsed by Next.js (common case without custom config)
    // This means we can't get the true raw body here directly without disabling Next.js's bodyParser.
    // The solution is to disable bodyParser for this specific API route.
    // If that's not done, signature verification will fail.
    // For now, we'll assume bodyParser is disabled or we reconstruct from parsed body (less secure).
    // The best way is:
    // export const config = { api: { bodyParser: false } };
    // Then, use a library like `raw-body` or streamToString here.

    // Reconstructing from JSON.stringify is NOT perfectly safe for signature verification
    // as field order or spacing can change.
    // THIS IS A FALLBACK AND HIGHLIGHTS THE NEED FOR `bodyParser: false`.
    if (typeof req.body === 'object' && req.body !== null) {
        console.warn("Reconstructing body from parsed JSON for signature verification. This is not ideal. Disable bodyParser for this route.");
        return resolve(Buffer.from(JSON.stringify(req.body), 'utf8'));
    }


    // If bodyParser is disabled, we need to read the stream.
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', (err) => reject(err));
  });
}

// It's crucial to disable Next.js's default body parser for webhook signature verification
// to ensure we get the raw, untampered request body.
// Add this export to the file:
// export const config = {
//   api: {
//     bodyParser: false,
//   },
// };
// The tool doesn't allow me to add this directly in a multi-part way.
// This will be noted in the summary.

export const config = {
  api: {
    bodyParser: false,
  },
};
