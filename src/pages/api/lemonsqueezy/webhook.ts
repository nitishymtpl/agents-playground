import type { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import { clerkClient } from '@clerk/nextjs/server';

const LEMON_SQUEEZY_WEBHOOK_SECRET = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;

if (!CLERK_SECRET_KEY) {
  console.warn(
    "CLERK_SECRET_KEY is not set. Clerk SDK calls in webhook will likely fail."
  );
}

// Define planId to credit amounts mapping
// TODO: Replace with actual Plan IDs from your Lemon Squeezy products
const planCredits: { [key: string]: number } = {
  'plan_basic': 100, // Example Plan ID from pricing.tsx
  'plan_pro': 500,   // Example Plan ID from pricing.tsx
  'plan_enterprise': 1500, // Example, assuming enterprise might also have a fixed credit amount or starting point
  // Add actual plan IDs (variant IDs if you sell variants as plans) from Lemon Squeezy
  // e.g. '12345': 100, (where 12345 is the Lemon Squeezy Variant ID)
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  if (LEMON_SQUEEZY_WEBHOOK_SECRET) {
    const signature = req.headers['x-signature'] as string | undefined;
    if (!signature) {
      console.warn('Webhook signature missing');
      return res.status(400).send('Signature missing');
    }
    try {
      const rawBody = await getRawBody(req);
      const expectedSignature = crypto
        .createHmac('sha256', LEMON_SQUEEZY_WEBHOOK_SECRET)
        .update(rawBody)
        .digest('hex');
      if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
        console.warn('Invalid webhook signature');
        return res.status(400).send('Invalid signature');
      }
    } catch (error) {
      console.error('Error verifying webhook signature:', error);
      return res.status(500).send('Error verifying signature');
    }
  } else {
    console.warn('LEMONSQUEEZY_WEBHOOK_SECRET is not set. Signature verification skipped.');
  }

  try {
    let eventPayload;
    const rawBody = await getRawBody(req);
    try {
      eventPayload = JSON.parse(rawBody.toString());
    } catch (e) {
      console.error("Error parsing webhook JSON payload:", e);
      return res.status(400).send("Invalid JSON payload");
    }

    const eventName = eventPayload?.meta?.event_name;
    const eventData = eventPayload?.data;
    const attributes = eventData?.attributes;
    const customData = eventPayload?.meta?.custom_data;
    const clerkUserId = customData?.clerk_user_id;
    // Lemon Squeezy Plan ID is usually the `variant_id` if you're selling variants as plans
    // or `product_id` if you sell products directly without variants, or a custom plan ID.
    // For subscriptions, `variant_id` is a key attribute.
    const lemonSqueezyPlanId = attributes?.variant_id?.toString();

    console.log(`Received Lemon Squeezy webhook. Event: ${eventName}, Clerk User ID: ${clerkUserId}, Plan ID: ${lemonSqueezyPlanId}`);

    if (!eventName) {
      console.warn('Webhook received without an event name.');
      return res.status(400).send('Event name missing');
    }

    if (!clerkUserId) {
      console.warn(`Webhook event ${eventName} received without a clerk_user_id in meta.custom_data. Cannot update user metadata or credits.`);
      // For critical events like subscription creation, you might want to return an error if no user ID is present.
      if (eventName === 'subscription_created') {
        return res.status(400).send('Clerk User ID (clerk_user_id) missing in webhook payload for subscription_created.');
      }
    }

    let userMetadataUpdate: any = {};

    switch (eventName) {
      case 'subscription_created':
      case 'subscription_updated':
      case 'subscription_payment_success':
        console.log(`Handling ${eventName} for Clerk User ID: ${clerkUserId}, Plan ID: ${lemonSqueezyPlanId}`);
        if (clerkUserId && attributes && lemonSqueezyPlanId) {
          const creditAmount = planCredits[lemonSqueezyPlanId] || 0;
          if (creditAmount === 0 && planCredits.hasOwnProperty(lemonSqueezyPlanId)) {
            console.log(`Plan ID ${lemonSqueezyPlanId} found in planCredits map but has 0 credits. Credits will be set to 0.`);
          } else if (creditAmount === 0) {
            console.warn(`Plan ID ${lemonSqueezyPlanId} not found in planCredits mapping or has 0 credits. Credits will be set to 0.`);
          }

          userMetadataUpdate = {
            lemonSqueezySubscriptionId: eventData?.id,
            lemonSqueezyPlanId: lemonSqueezyPlanId,
            lemonSqueezyStatus: attributes.status,
            lemonSqueezyVariantId: attributes.variant_id, // Same as lemonSqueezyPlanId if using variants for plans
            lemonSqueezyProductId: attributes.product_id,
            lemonSqueezyEndsAt: attributes.ends_at,
            lemonSqueezyCustomerPortalUrl: attributes.urls?.customer_portal,
            lemonSqueezyTestMode: attributes.test_mode,
            planCreditAmount: creditAmount,
            creditsAvailable: creditAmount, // Reset/set credits to plan amount
          };
        } else if (!clerkUserId) {
             console.warn(`Cannot process ${eventName}: clerk_user_id is missing in meta.custom_data.`);
        } else {
            console.warn(`Cannot process ${eventName} for user ${clerkUserId}: attributes or planId missing from webhook.`);
        }
        break;

      case 'subscription_cancelled':
      case 'subscription_expired':
        console.log(`Handling ${eventName} for Clerk User ID: ${clerkUserId}, Plan ID: ${lemonSqueezyPlanId}`);
        if (clerkUserId && attributes) {
          userMetadataUpdate = {
            lemonSqueezySubscriptionId: eventData?.id,
            lemonSqueezyPlanId: lemonSqueezyPlanId, // Keep plan ID for reference if needed
            lemonSqueezyStatus: attributes.status,
            lemonSqueezyEndsAt: attributes.ends_at,
            lemonSqueezyVariantId: attributes.variant_id,
            lemonSqueezyProductId: attributes.product_id,
            lemonSqueezyCustomerPortalUrl: attributes.urls?.customer_portal,
            lemonSqueezyTestMode: attributes.test_mode,
            planCreditAmount: 0, // Reset credit amount for the plan
            creditsAvailable: 0, // Reset available credits
          };
        } else if (!clerkUserId) {
            console.warn(`Cannot process ${eventName}: clerk_user_id is missing in meta.custom_data.`);
        } else {
            console.warn(`Cannot process ${eventName} for user ${clerkUserId}: attributes missing from webhook.`);
        }
        break;
      default:
        console.log(`Unhandled event type: ${eventName} for Clerk User ID: ${clerkUserId}. No metadata or credit change.`);
    }

    if (clerkUserId && Object.keys(userMetadataUpdate).length > 0) {
      try {
        // Fetch existing metadata to merge, preserving other publicMetadata fields
        const existingUser = await clerkClient.users.getUser(clerkUserId);
        const existingPublicMetadata = existingUser.publicMetadata || {};

        const newPublicMetadata = { ...existingPublicMetadata, ...userMetadataUpdate };

        await clerkClient.users.updateUserMetadata(clerkUserId, {
          publicMetadata: newPublicMetadata,
        });
        console.log(`Successfully updated Clerk user ${clerkUserId} publicMetadata for ${eventName} with new data:`, userMetadataUpdate);
      } catch (error) {
        console.error(`Error updating Clerk user ${clerkUserId} metadata for ${eventName}:`, error);
      }
    }

    res.status(200).json({ message: 'Webhook received successfully' });
  } catch (error) {
    console.error('Error processing Lemon Squeezy webhook:', error);
    if (error instanceof SyntaxError) {
        return res.status(400).json({ error: 'Invalid JSON payload' });
    }
    res.status(500).json({ error: 'Error processing webhook' });
  }
}

async function getRawBody(req: NextApiRequest): Promise<Buffer> {
  if ((req as any)._rawBody) {
    return (req as any)._rawBody;
  }
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const buffer = Buffer.concat(chunks);
      (req as any)._rawBody = buffer;
      resolve(buffer);
    });
    req.on('error', (err) => {
        console.error('Error in getRawBody:', err);
        reject(err);
    });
  });
}

export const config = {
  api: {
    bodyParser: false,
  },
};
