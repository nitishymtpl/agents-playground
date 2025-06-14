import type { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import { clerkClient } from '@clerk/nextjs/server';

// Initial Environment Variable Checks
const {
  LEMONSQUEEZY_API_KEY,
  LEMONSQUEEZY_STORE_ID,
  LEMONSQUEEZY_WEBHOOK_SECRET,
  CLERK_SECRET_KEY,
} = process.env;

const requiredEnvVars = {
  LEMONSQUEEZY_API_KEY,
  LEMONSQUEEZY_STORE_ID,
  LEMONSQUEEZY_WEBHOOK_SECRET,
  CLERK_SECRET_KEY,
};

let hasMissingEnvVars = false;
for (const [key, value] of Object.entries(requiredEnvVars)) {
  if (!value) {
    console.error(
      `CRITICAL CONFIGURATION ERROR: ${key} is not set. Webhook processing will likely fail or be insecure.`
    );
    hasMissingEnvVars = true;
  }
}
// Note: This console error will appear in the server logs when the API route is initialized,
// not necessarily on every request, depending on the serverless function lifecycle.
// For per-request validation if needed, these checks could be inside the handler.

// Define planId to credit amounts mapping
const planCredits: { [key: string]: number } = {
  'plan_basic': 100,
  'plan_pro': 500,
  'plan_enterprise': 1500,
  // Add actual plan IDs (variant IDs) from Lemon Squeezy
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Per-request check can also be useful if env vars could change between deployments without restart
  if (hasMissingEnvVars) {
    // Optionally, prevent processing if critical env vars are missing, even if the handler is called.
    // This depends on how strictly you want to enforce this.
    console.error("Webhook handler invoked, but critical environment variables are missing. Aborting.");
    return res.status(500).send("Server configuration error.");
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  // Signature verification (relies on LEMONSQUEEZY_WEBHOOK_SECRET)
  if (LEMONSQUEEZY_WEBHOOK_SECRET) {
    const signature = req.headers['x-signature'] as string | undefined;
    if (!signature) {
      console.warn('Webhook signature missing');
      return res.status(400).send('Signature missing');
    }
    try {
      const rawBody = await getRawBody(req);
      const expectedSignature = crypto
        .createHmac('sha256', LEMONSQUEEZY_WEBHOOK_SECRET)
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
    // This was already logged by the initial check, but keeping it here ensures
    // that if the initial check logic changes, signature skipping is still noted.
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
    const lemonSqueezyPlanId = attributes?.variant_id?.toString();

    console.log(`Received Lemon Squeezy webhook. Event: ${eventName}, Clerk User ID: ${clerkUserId}, Plan ID: ${lemonSqueezyPlanId}`);

    if (!eventName) {
      console.warn('Webhook received without an event name.');
      return res.status(400).send('Event name missing');
    }

    if (!clerkUserId) {
      console.warn(`Webhook event ${eventName} received without a clerk_user_id in meta.custom_data. Cannot update user metadata or credits.`);
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
          if (creditAmount === 0 && !planCredits.hasOwnProperty(lemonSqueezyPlanId)) {
             console.warn(`Plan ID ${lemonSqueezyPlanId} not found in planCredits mapping. Credits will be set to 0.`);
          } else if (creditAmount === 0 && planCredits.hasOwnProperty(lemonSqueezyPlanId)) {
            console.log(`Plan ID ${lemonSqueezyPlanId} found in planCredits map but is configured for 0 credits.`);
          }


          userMetadataUpdate = {
            lemonSqueezySubscriptionId: eventData?.id,
            lemonSqueezyPlanId: lemonSqueezyPlanId,
            lemonSqueezyStatus: attributes.status,
            lemonSqueezyVariantId: attributes.variant_id,
            lemonSqueezyProductId: attributes.product_id,
            lemonSqueezyEndsAt: attributes.ends_at,
            lemonSqueezyCustomerPortalUrl: attributes.urls?.customer_portal,
            lemonSqueezyTestMode: attributes.test_mode,
            planCreditAmount: creditAmount,
            creditsAvailable: creditAmount,
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
            lemonSqueezyPlanId: lemonSqueezyPlanId,
            lemonSqueezyStatus: attributes.status,
            lemonSqueezyEndsAt: attributes.ends_at,
            lemonSqueezyVariantId: attributes.variant_id,
            lemonSqueezyProductId: attributes.product_id,
            lemonSqueezyCustomerPortalUrl: attributes.urls?.customer_portal,
            lemonSqueezyTestMode: attributes.test_mode,
            planCreditAmount: 0,
            creditsAvailable: 0,
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
