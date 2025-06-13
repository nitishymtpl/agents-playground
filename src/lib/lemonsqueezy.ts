import { lemonSqueezySetup } from "@lemonsqueezy/lemonsqueezy.js";

const apiKey = process.env.LEMONSQUEEZY_API_KEY;

if (!apiKey) {
  console.warn(
    "LEMONSQUEEZY_API_KEY environment variable is not set. Lemon Squeezy functionality will be disabled."
  );
  // Depending on the SDK's behavior, further calls might fail or be no-ops.
  // For now, we allow the app to run but log a warning.
  // It's also possible to throw an error here to enforce presence of API key.
} else {
  lemonSqueezySetup({
    apiKey: apiKey,
    onError: (error) => {
      // Type assertion for error object
      const e = error as { message?: string; cause?: unknown };
      console.error("Lemon Squeezy Setup Error:", e.message || 'Unknown error');
      if (e.cause) {
        console.error("Cause:", e.cause);
      }
    },
  });
  console.log("Lemon Squeezy SDK initialized.");
}

// We are not exporting a client instance directly with this setup.
// Instead, other parts of the application will import functions directly from "@lemonsqueezy/lemonsqueezy.js"
// which will use the global setup.

// Example of how to export a function if needed, though typically not necessary with lemonSqueezySetup
/*
import { listProducts } from "@lemonsqueezy/lemonsqueezy.js";

export async function getProducts() {
  if (!apiKey) {
    console.error("Lemon Squeezy client not initialized because API key is missing.");
    return null;
  }
  try {
    const { data, error, statusCode } = await listProducts();
    if (error) {
      console.error('Error fetching products from Lemon Squeezy:', error);
      return null;
    }
    return data;
  } catch (err) {
    console.error('Exception when fetching products:', err);
    return null;
  }
}
*/
