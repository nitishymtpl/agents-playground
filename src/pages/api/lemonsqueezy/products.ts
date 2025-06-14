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

const allowedVariantStatuses = ['active', 'published']; // Allowing 'active' and 'published'

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
        console.error("Lemon Squeezy SDK Error:", error);
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
      // Product status filtering remains unchanged
      if (product.attributes.status !== 'published') {
        console.log(`Skipping product ID ${product.id} as it's not published (status: ${product.attributes.status}).`);
        continue;
      }

      const { data: variantsData, error: variantsError } = await listVariants({
        filter: { product_id: product.id },
        // include: ['product'] // Not strictly needed if all product info is already used from product loop
      });

      if (variantsError) {
        console.error(`Error fetching variants for product ID ${product.id}:`, variantsError);
        continue;
      }
      if (!variantsData) {
        console.warn(`No variants data returned for product ID ${product.id}.`);
        continue;
      }

      for (const variant of variantsData.data) {
        // Log all retrieved variant statuses before filtering
        console.log(`Retrieved variant ID ${variant.id} for product ${product.id} with status: ${variant.attributes.status}`);

        // Updated variant status filtering logic
        if (!allowedVariantStatuses.includes(variant.attributes.status)) {
            console.log(`Skipping variant ID ${variant.id} for product ID ${product.id} as its status ('${variant.attributes.status}') is not in allowed list: [${allowedVariantStatuses.join(', ')}].`);
            continue;
        }

        const features = product.attributes.description
          ?.split('\n')
          .map(f => f.trim())
          .filter(f => f.length > 0)
          || [];

        const plan: Plan = {
          id: variant.id.toString(),
          name: variant.attributes.name || product.attributes.name,
          productName: product.attributes.name,
          price: variant.attributes.price,
          currency: product.attributes.price_options?.currency || 'USD', // Assuming currency is on product or fallback
          period: getInterval(variant as Variant),
          features: features,
          sort: product.attributes.sort || 0,
          status: product.attributes.status,
          variantStatus: variant.attributes.status,
          variantIdForCheckout: variant.id.toString(),
          // priceFormatted will be set below
        };

        if (variant.attributes.price === null) {
          plan.priceFormatted = "Contact Us";
        } else if (typeof variant.attributes.price === 'number') {
          const priceInMajorUnit = (variant.attributes.price / 100).toFixed(2);
          plan.priceFormatted = `${priceInMajorUnit} ${plan.currency}`;
          if (plan.period) {
            plan.priceFormatted += `/${plan.period}`;
          }
        } else {
          // Fallback if price is neither null nor number (should not happen with LS data)
          plan.priceFormatted = "Price unavailable";
        }

        allPlans.push(plan);
      }
    }

    allPlans.sort((a, b) => {
        if (a.sort !== b.sort) {
            return a.sort - b.sort;
        }
        return a.price - b.price;
    });

    res.status(200).json(allPlans);

  } catch (error: any) {
    console.error('Unexpected error in /api/lemonsqueezy/products:', error);
    res.status(500).json({ error: 'An unexpected error occurred.', details: error.message });
  }
}
