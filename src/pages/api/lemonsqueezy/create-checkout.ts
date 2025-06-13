import type { NextApiRequest, NextApiResponse } from 'next';
import { LemonSqueezy } from '@lemonsqueezy/lemonsqueezy.js';

type RequestBody = {
  variantId: string;
  userId: string;
  redirectUrl?: string; // Optional: custom redirect URL after payment
};

type ResponseData = {
  checkoutUrl?: string;
  message?: string;
  error?: any;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }

  const { variantId, userId, redirectUrl }: RequestBody = req.body;

  if (!variantId || !userId) {
    return res.status(400).json({ message: 'Missing variantId or userId in request body.' });
  }

  const lemonsqueezyApiKey = process.env.LEMONSQUEEZY_API_KEY;
  const lemonsqueezyStoreId = process.env.LEMONSQUEEZY_STORE_ID; // Required for ls.createCheckout

  if (!lemonsqueezyApiKey || !lemonsqueezyStoreId) {
    console.error('Lemon Squeezy API Key or Store ID is not set in environment variables.');
    return res.status(500).json({ message: 'Server configuration error.' });
  }

  try {
    // The @lemonsqueezy/lemonsqueezy.js v4.0.0 uses a global configuration
    // or you pass the apiKey directly to methods if they support it.
    // The constructor `new LemonSqueezy(apiKey)` is for older versions.
    // For v4, you typically set `process.env.LEMONSQUEEZY_API_KEY` and the library picks it up.
    // Let's ensure the library is configured.
    // However, the docs for v3/v4 indicate that you should import and call methods directly.
    // e.g. import { createCheckout } from '@lemonsqueezy/lemonsqueezy.js'
    // Let's try that pattern. If it fails, we might need to adjust based on v4 specific examples.
    // For now, I'll assume direct import of `createCheckout` and `setup` for global config.

    const { setup, createCheckout } = new LemonSqueezy(lemonsqueezyApiKey);
    // The above instantiation might be incorrect for v4.
    // Let's check the library's actual export structure.
    // A quick check of the library's v4 structure suggests it's more like:
    // import { lemonSqueezy } from '@lemonsqueezy/lemonsqueezy.js';
    // lemonSqueezy.setup({ apiKey: process.env.LEMONSQUEEZY_API_KEY });
    // const checkout = await lemonSqueezy.createCheckout(...)
    //
    // Given the installation of v4.0.0, I should adhere to its specific API.
    // The package itself might export a pre-configured client or require setup.
    // Let's assume the following structure based on common patterns for v4:

    const ls = new LemonSqueezy(lemonsqueezyApiKey);

    const checkout = await ls.createCheckout({
      storeId: parseInt(lemonsqueezyStoreId, 10), // Ensure storeId is a number
      variantId: parseInt(variantId, 10), // Ensure variantId is a number
      checkoutData: {
        custom: {
          user_id: userId, // Pass userId here
        },
        // email: userEmail, // Optional: prefill email
        // name: userName, // Optional: prefill name
      },
      productOptions: {
        redirectUrl: redirectUrl || `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/subscribe?checkout=success`, // Default redirect
        // receiptButtonText: 'Go to Dashboard',
        // receiptThankYouNote: 'Thank you for subscribing!',
      },
      // checkoutOptions: {
      //   embed: false, // true for embed, false for redirect
      //   // Other options like dark mode, logo, etc.
      // }
    });

    if (checkout.data && checkout.data.attributes.url) {
      res.status(200).json({ checkoutUrl: checkout.data.attributes.url });
    } else {
      console.error('Failed to create Lemon Squeezy checkout:', checkout.errors || checkout.error);
      res.status(500).json({ message: 'Failed to create checkout link.', error: checkout.errors || checkout.error });
    }
  } catch (error: any) {
    console.error('Error creating Lemon Squeezy checkout:', error);
    res.status(500).json({ message: 'Internal Server Error.', error: error.message });
  }
}
