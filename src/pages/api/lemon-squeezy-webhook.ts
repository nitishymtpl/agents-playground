import type { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import { clerkClient } from '@clerk/nextjs/server';
import '@/lib/lemonsqueezy';

const parseJson = (str: string) => {
  try { return JSON.parse(str); } catch (e) { return null; }
};

export const config = {
  api: { bodyParser: false },
};

interface UserSubscriptionMetadata {
  lemonSqueezySubscriptionId?: string | null;
  lemonSqueezyPlanId?: string | null;
  lemonSqueezyVariantName?: string | null;
  lemonSqueezySubscriptionStatus?: string | null;
  lemonSqueezySubscriptionEndDate?: string | null;
  lemonSqueezyRenewsAt?: string | null;
  lemonSqueezyCustomerId?: string | null;
  lemonSqueezyCustomerPortalUrl?: string | null; // Added field
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end('Method Not Allowed');
  }

  const signingSecret = process.env.LEMONSQUEEZY_WEBHOOK_SIGNING_SECRET;
  if (!signingSecret) {
    console.error('Lemon Squeezy webhook signing secret is not configured.');
    return res.status(500).json({ error: 'Server configuration error: Missing webhook secret.' });
  }

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  const rawBody = Buffer.concat(chunks).toString('utf-8');
  const signature = req.headers['x-signature'] as string | undefined;

  if (!signature) {
    return res.status(400).json({ error: 'Missing webhook signature.' });
  }

  const hmac = crypto.createHmac('sha256', signingSecret);
  const digest = Buffer.from(hmac.update(rawBody).digest('hex'), 'utf8');
  const receivedSignature = Buffer.from(signature, 'utf8');

  if (!crypto.timingSafeEqual(digest, receivedSignature)) {
    return res.status(403).json({ error: 'Invalid signature.' });
  }

  const eventPayload = parseJson(rawBody);
  if (!eventPayload) {
    return res.status(400).json({ error: 'Invalid JSON payload.' });
  }

  const eventName = eventPayload.meta?.event_name;
  const eventData = eventPayload.data;
  const customData = eventPayload.meta?.custom_data;
  const userIdFromCustomData = customData?.user_id;

  console.log(`Received Lemon Squeezy webhook: ${eventName}`, { eventId: eventPayload.meta?.event_id });

  try {
    let userIdToUpdate: string | null = userIdFromCustomData;

    if (!userIdToUpdate && eventData?.attributes?.customer_id) {
      console.warn(`Webhook event ${eventName} for customer ${eventData.attributes.customer_id} did not have user_id in custom_data. User identification might fail or require lookup.`);
      // Further lookup logic would go here if strictly needed
    }

    if (!userIdToUpdate) {
      console.error(`Webhook event ${eventName}: Could not determine user ID. Skipping update.`);
      return res.status(200).json({ received: true, message: "Webhook processed, but no user ID found to update." });
    }

    let metadataToUpdate: Partial<UserSubscriptionMetadata> = {}; // Use Partial for updates

    switch (eventName) {
      case 'subscription_created':
      case 'subscription_updated':
        metadataToUpdate = {
          lemonSqueezySubscriptionId: eventData.id,
          lemonSqueezyPlanId: String(eventData.attributes.variant_id),
          lemonSqueezyVariantName: eventData.attributes.product_name + " - " + eventData.attributes.variant_name,
          lemonSqueezySubscriptionStatus: eventData.attributes.status,
          lemonSqueezySubscriptionEndDate: eventData.attributes.ends_at,
          lemonSqueezyRenewsAt: eventData.attributes.renews_at,
          lemonSqueezyCustomerId: String(eventData.attributes.customer_id),
          lemonSqueezyCustomerPortalUrl: eventData.attributes.urls?.customer_portal_update_subscription || eventData.attributes.urls?.customer_portal || null,
        };
        console.log(`Updating Clerk user ${userIdToUpdate} for event ${eventName}`, metadataToUpdate);
        // Fetch existing metadata first to merge, not overwrite unrelated fields
        const existingUser = await clerkClient.users.getUser(userIdToUpdate);
        await clerkClient.users.updateUserMetadata(userIdToUpdate, {
          publicMetadata: {
            ...existingUser.publicMetadata,
            ...metadataToUpdate,
          }
        });
        break;

      case 'subscription_cancelled':
        // Fetch existing metadata to preserve other fields
        const userToCancel = await clerkClient.users.getUser(userIdToUpdate);
        metadataToUpdate = {
          // ...userToCancel.publicMetadata, // Start with existing: This was slightly incorrect, should merge selectively
          lemonSqueezySubscriptionId: eventData.id, // Ensure this is set if it changed or for consistency
          lemonSqueezySubscriptionStatus: eventData.attributes.status,
          lemonSqueezySubscriptionEndDate: eventData.attributes.ends_at,
          lemonSqueezyRenewsAt: null, // Explicitly nullify renewal
          // customer_portal_url might still be valid for viewing history, so we keep existing or set to null if business logic dictates
          // For example, if you want to keep it:
          // lemonSqueezyCustomerPortalUrl: userToCancel.publicMetadata?.lemonSqueezyCustomerPortalUrl,
          // If you want to clear it:
          // lemonSqueezyCustomerPortalUrl: null,
        };
        console.log(`Updating Clerk user ${userIdToUpdate} for event ${eventName}`, metadataToUpdate);
        await clerkClient.users.updateUserMetadata(userIdToUpdate, {
          publicMetadata: {
             ...(userToCancel.publicMetadata), // Preserve existing metadata fully
            ...metadataToUpdate, // Overwrite with new values for cancellation
          }
        });
        break;

      default:
        console.log(`Unhandled or non-subscription related Lemon Squeezy webhook event: ${eventName}`);
        return res.status(200).json({ received: true, message: `Event ${eventName} received but not processed for user update.` });
    }

    res.status(200).json({ received: true, event: eventName, userIdUpdated: userIdToUpdate });

  } catch (error) {
    const e = error as any;
    console.error(`Error processing webhook event ${eventName}:`, e.message, e.response?.data);
    res.status(e?.status || 500).json({ error: 'Failed to process webhook', details: e.message });
  }
}
