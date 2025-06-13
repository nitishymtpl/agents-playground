import type { NextApiRequest, NextApiResponse } from 'next';
import { createCheckout } from '@lemonsqueezy/lemonsqueezy.js';
import '@/lib/lemonsqueezy'; // Ensures lemonSqueezySetup is called

// Define a type for our expected plan structure (can be expanded)
interface PlanVariant {
  id: string; // This MUST be your Lemon Squeezy Variant ID
  name: string;
  // Add any other relevant plan details if needed
}

// Example: Map query param 'plan' to Lemon Squeezy Variant IDs
// IMPORTANT: Replace these with your ACTUAL Lemon Squeezy Variant IDs
const PLANS: Record<string, PlanVariant> = {
  basic: { id: 'your_basic_variant_id', name: 'Basic Plan' }, // e.g., '12345'
  pro: { id: 'your_pro_variant_id', name: 'Pro Plan' },       // e.g., '67890'
  premium: { id: 'your_premium_variant_id', name: 'Premium Plan' }, // e.g., '11223'
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { plan: planKey, userId, userEmail } = req.query; // Assuming you might pass userId and userEmail

  if (typeof planKey !== 'string' || !PLANS[planKey]) {
    return res.status(400).json({ error: 'Invalid or missing plan parameter.' });
  }

  const selectedPlan = PLANS[planKey];
  const storeId = process.env.LEMONSQUEEZY_STORE_ID;
  const apiKey = process.env.LEMONSQUEEZY_API_KEY; // Used by lemonSqueezySetup

  if (!storeId) {
    console.error('Lemon Squeezy Store ID is not configured.');
    return res.status(500).json({ error: 'Server configuration error: Missing Store ID.' });
  }
  if (!apiKey) {
    // This is checked in lemonSqueezySetup, but good to be aware
    console.error('Lemon Squeezy API Key is not configured.');
    return res.status(500).json({ error: 'Server configuration error: Missing API Key.' });
  }

  const currentHost = req.headers.host || 'localhost:3000';
  const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
  // It's good practice to have specific success/cancel pages or query params
  const redirectUrl = `${protocol}://${currentHost}/profile?payment_status=success`;
  const eventUrl = `${protocol}://${currentHost}/pricing?payment_status=event`; // For other events like cancel

  try {
    const checkoutOptions: any = {
      checkoutData: {
        // email: userEmail && typeof userEmail === 'string' ? userEmail : undefined, // Optional: prefill customer email
        // custom: { // Optional: pass custom data to be returned in webhooks
        //   user_id: userId && typeof userId === 'string' ? userId : undefined,
        // },
      },
      productOptions: {
        // redirectUrl: redirectUrl, // The main redirect URL after successful payment
        // enabledVariants: [selectedPlan.id] // Ensure only this variant is available if others exist on product
      },
      // store: storeId, // The store ID string
      // variant: selectedPlan.id, // The variant ID string
      redirectUrl: redirectUrl,
      // testMode: process.env.NODE_ENV !== 'production', // SDK might handle this based on API key type (live vs test)
    };

    // For older SDK versions, structure might be different.
    // The `createCheckout` function in v2.2.0 might take storeId and variantId as direct params
    // or expect them nested differently. This is a common structure.
    // We'll need to adjust if the SDK's API for v2.2.0 is significantly different.

    // Let's assume for v2.2.0, createCheckout might take storeId and variantId more directly.
    // This is a guess based on common API patterns.
    // The actual call might be:
    // createCheckout(storeId, selectedPlan.id, checkoutOptions)
    // OR the SDK might use the globally configured API key to infer the store if it's singular for that key.

    // The documentation for v2.2.0 is not readily available, so we're adapting from general knowledge.
    // The most common signature for createCheckout is (attributes: CheckoutAttributes)
    // where attributes include store, variant, custom data, redirect_url etc.

    const newCheckout = await createCheckout(storeId, selectedPlan.id, {
        checkoutData: {
          email: userEmail && typeof userEmail === 'string' ? userEmail : undefined,
          custom: {
            user_id: userId && typeof userId === 'string' ? userId : undefined,
            plan_key: planKey, // Good to pass this through
          },
        },
        // productOptions: {
        //   redirectUrl: redirectUrl, // Main redirect after payment
        // },
        // checkoutOptions: {
        //   redirectUrl: redirectUrl, // This is often the primary redirect URL field
        // },
        redirectUrl: redirectUrl, // Often a top-level param for the success URL
        // testMode: process.env.NODE_ENV !== 'production', // Test mode is usually determined by the API key type
    });

    if (newCheckout && newCheckout.data && newCheckout.data.attributes && newCheckout.data.attributes.url) {
      // The SDK v2.2.0 might wrap the response differently, e.g. newCheckout.url directly
      // For example if newCheckout.data is the checkout object itself:
      // const checkoutUrl = newCheckout.data.attributes.url;
      // Or if newCheckout is the direct checkout object:
      // const checkoutUrl = newCheckout.attributes.url;
      // Let's assume the structure from the error object in the SDK setup: { data, error, statusCode }

      const checkoutUrl = newCheckout.data.attributes.url;
      res.redirect(303, checkoutUrl);
    } else if (newCheckout.error) {
      console.error('Failed to create Lemon Squeezy checkout:', newCheckout.error);
      res.status(500).json({ error: 'Failed to create checkout session.', details: newCheckout.error });
    }
     else {
      console.error('Failed to create Lemon Squeezy checkout: Unknown error or unexpected response structure', newCheckout);
      res.status(500).json({ error: 'Failed to create checkout session due to an unexpected response.' });
    }

  } catch (error) {
    const e = error as { message?: string, cause?: unknown, response?: { data?: any } };
    console.error('Error creating Lemon Squeezy checkout:', e.message, e.cause, e.response?.data);
    res.status(500).json({ error: e.message || 'Internal server error.', details: e.response?.data });
  }
}
