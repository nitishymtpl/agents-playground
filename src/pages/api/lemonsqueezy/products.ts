import type { NextApiRequest, NextApiResponse } from 'next';
import { lemonSqueezySetup, listProducts, listVariants, Variant } from '@lemonsqueezy/lemonsqueezy.js';

// Types for our transformed plan object
export interface Plan {
  id: string; // Variant ID
  name: string; // Variant name or Product name
  productName: string;
  priceFormatted: string;
  price: number; // Numeric price in cents
  currency: string;
  period?: string | null; // e.g., "month", "year"
  features: string[];
  sort: number;
  status?: string; // Product status
  variantStatus?: string; // Variant status
  variantIdForCheckout: string; // This will be the variant ID itself
}

// Helper to extract interval from variant attributes if it exists
function getInterval(variant: Variant): string | null {
    if (variant.attributes.is_subscription && variant.attributes.interval) {
        return variant.attributes.interval;
    }
    return null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const apiKey = process.env.LEMONSQUEEZY_API_KEY;
  const storeId = process.env.LEMONSQUEEZY_STORE_ID;

  if (!apiKey) {
    console.error("CRITICAL CONFIGURATION ERROR: LEMONSQUEEZY_API_KEY is not set. Cannot fetch products.");
    return res.status(500).json({ error: 'Server configuration error: Missing API key.' });
  }
  if (!storeId) {
    console.error("CRITICAL CONFIGURATION ERROR: LEMONSQUEEZY_STORE_ID is not set. Cannot fetch products.");
    return res.status(500).json({ error: 'Server configuration error: Missing Store ID.' });
  }

  try {
    lemonSqueezySetup({
      apiKey: apiKey,
      onError: (error) => {
        // This global error handler can catch SDK-level issues
        console.error("Lemon Squeezy SDK Error:", error);
        // Decide if you want to throw it to be caught by the main try-catch or handle here
      }
    });

    const { data: productsData, error: productsError } = await listProducts({ filter: { store_id: storeId } });

    if (productsError) {
      console.error('Error fetching products from Lemon Squeezy:', productsError);
      return res.status(500).json({ error: 'Failed to fetch products.', details: productsError.message });
    }
    if (!productsData) {
        console.error('No products data returned from Lemon Squeezy.');
        return res.status(500).json({ error: 'Failed to fetch products (no data).' });
    }

    const allPlans: Plan[] = [];

    for (const product of productsData.data) {
      if (product.attributes.status !== 'published') {
        console.log(`Skipping product ID ${product.id} as it's not published (status: ${product.attributes.status}).`);
        continue;
      }

      const { data: variantsData, error: variantsError } = await listVariants({
        filter: { product_id: product.id },
        include: ['product'] // Ensure product data is included if needed, though we have it
      });

      if (variantsError) {
        console.error(`Error fetching variants for product ID ${product.id}:`, variantsError);
        // Decide if you want to skip this product or return an overall error
        continue; // Skip this product's variants
      }
      if (!variantsData) {
        console.warn(`No variants data returned for product ID ${product.id}.`);
        continue;
      }

      for (const variant of variantsData.data) {
        // Assuming variant status 'active' is the one we want.
        // Lemon Squeezy variant status can be 'pending', 'active', 'inactive', 'draft'
        if (variant.attributes.status !== 'active') {
            console.log(`Skipping variant ID ${variant.id} for product ID ${product.id} as it's not active (status: ${variant.attributes.status}).`);
            continue;
        }

        // Extract features from product description (split by newline)
        // This is a basic implementation; you might have more structured feature data elsewhere
        const features = product.attributes.description
          ?.split('\n')
          .map(f => f.trim())
          .filter(f => f.length > 0) // Ensure feature string is not empty
          || []; // Default to an empty array if no features

        const plan: Plan = {
          id: variant.id.toString(),
          name: variant.attributes.name || product.attributes.name, // Use variant name, fallback to product name
          productName: product.attributes.name,
          priceFormatted: variant.attributes.price_formatted || 'N/A', // price_formatted seems to be a custom field in some examples, or construct it.
                                                                      // Actual price is in `price` (cents).
                                                                      // The SDK might not directly provide `price_formatted`.
                                                                      // Let's assume we want to show the price from the variant.
                                                                      // If `variant.attributes.price` is in cents:
          price: variant.attributes.price, // price in cents
          currency: product.attributes.price_options?.currency || 'USD', // Fallback, or get from variant if available
          period: getInterval(variant as Variant), // Get subscription interval
          features: features,
          sort: product.attributes.sort || 0,
          status: product.attributes.status,
          variantStatus: variant.attributes.status,
          variantIdForCheckout: variant.id.toString(),
        };

        // Construct priceFormatted if not directly available
        if (plan.priceFormatted === 'N/A' && typeof plan.price === 'number') {
            const priceInMajorUnit = (plan.price / 100).toFixed(2);
            plan.priceFormatted = `${priceInMajorUnit} ${plan.currency}`;
            if (plan.period) {
                plan.priceFormatted += `/${plan.period}`;
            }
        }


        allPlans.push(plan);
      }
    }

    // Sort plans by product sort order, then by variant sort order (if available, or by price/ID)
    allPlans.sort((a, b) => {
        if (a.sort !== b.sort) {
            return a.sort - b.sort;
        }
        // Add secondary sort if needed, e.g., by price or variant ID
        return a.price - b.price;
    });

    res.status(200).json(allPlans);

  } catch (error: any) {
    console.error('Unexpected error in /api/lemonsqueezy/products:', error);
    res.status(500).json({ error: 'An unexpected error occurred.', details: error.message });
  }
}
