import React, { useEffect, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import Head from 'next/head';

// Define the Plan type for frontend, matching the API response
export interface Plan {
  id: string; // Variant ID
  name: string;
  productName: string;
  priceFormatted: string;
  price: number;
  currency: string;
  period?: string | null;
  features: string[];
  sort: number;
  status?: string;
  variantStatus?: string;
  variantIdForCheckout: string;
}

const PricingPage = () => {
  const { user, isSignedIn } = useUser();
  const storeDomain = process.env.NEXT_PUBLIC_LEMONSQUEEZY_STORE_DOMAIN;
  const isStoreDomainConfigured = storeDomain && storeDomain.trim() !== '';

  const [plans, setPlans] = useState<Plan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);


  useEffect(() => {
    if (!isStoreDomainConfigured) {
      const errorMsg = "Error: NEXT_PUBLIC_LEMONSQUEEZY_STORE_DOMAIN is not set. This is required for the pricing page to function correctly. Please check your environment variables.";
      console.error(errorMsg);
      setConfigError("Configuration Error: The subscription system is currently unavailable. Please contact support if this issue persists.");
      setIsLoading(false); // Don't attempt to load if base config is missing
      return;
    }

    const fetchPlans = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/lemonsqueezy/products');
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Failed to fetch plans: ${response.statusText}`);
        }
        const data: Plan[] = await response.json();
        setPlans(data);
      } catch (e: any) {
        console.error("Failed to fetch or parse plans:", e);
        setError(e.message || 'An unknown error occurred while fetching plans.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchPlans();
  }, [isStoreDomainConfigured]); // Rerun if isStoreDomainConfigured changes, though it's env-based

  const handleChoosePlan = (variantId: string, planName?: string) => {
    if (planName === 'Enterprise') { // Or check variantId if you have a specific one for "Contact Us"
        window.location.href = 'mailto:sales@example.com?subject=Enterprise Plan Inquiry';
        return;
    }

    if (!isSignedIn) {
      alert('Please sign in to choose a plan.');
      return;
    }

    if (!isStoreDomainConfigured) {
      // This alert is a fallback, primary error display is via configError state.
      alert("Subscription system is currently unavailable due to a configuration issue.");
      return;
    }

    let checkoutUrl = `https://${storeDomain}/checkout/buy/${variantId}`;

    if (user?.id) {
      checkoutUrl += `?checkout[custom][clerk_user_id]=${user.id}`;
    } else {
      console.warn("User is signed in, but user ID is not available for checkout. Proceeding without clerk_user_id.");
    }

    console.log(`Redirecting to Lemon Squeezy checkout: ${checkoutUrl}`);
    window.location.href = checkoutUrl;
  };

  return (
    <>
      <Head>
        <title>Pricing Plans - LiveKit Agent Playground</title>
        <meta name="description" content="Choose a subscription plan that fits your needs." />
      </Head>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold text-center mb-12">Our Pricing Plans</h1>

        {configError && (
          <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md mb-8" role="alert">
            <p className="font-bold">Configuration Error</p>
            <p>{configError.replace("Configuration Error: ", "")}</p>
          </div>
        )}

        {isLoading && !configError && <p className="text-center text-lg">Loading plans...</p>}

        {!isLoading && error && !configError && (
          <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 rounded-md mb-8" role="alert">
            <p className="font-bold">Error Loading Plans</p>
            <p>{error} Please try again later.</p>
          </div>
        )}

        {!isLoading && !error && !configError && plans.length === 0 && (
            <p className="text-center text-lg">No pricing plans are currently available. Please check back later.</p>
        )}

        {!isLoading && !error && !configError && plans.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {plans.map((plan) => (
              <div key={plan.id} className="border p-6 rounded-lg shadow-lg relative flex flex-col">
                {/* Popular flag can be added to Plan type if needed */}
                {/* {plan.popular && (
                  <div className="absolute top-0 left-1/2 transform -translate-x-1/2 bg-pink-500 text-white px-3 py-1 rounded-b-md text-sm font-semibold">
                    Most Popular
                  </div>
                )} */}
                <h2 className={`text-2xl font-semibold mb-2`}>{plan.name}</h2>
                <p className="text-sm text-gray-500 mb-4">Product: {plan.productName}</p>

                <p className="text-3xl font-bold mb-1">
                  {plan.priceFormatted.includes("Contact Us") ? "Contact Us" : plan.priceFormatted.split(" ")[0]}
                </p>
                <p className="text-xs text-gray-600 mb-4 h-6">
                  { !plan.priceFormatted.includes("Contact Us") &&
                    (plan.priceFormatted.split(" ")[1] || "") + " " + (plan.priceFormatted.split(" ")[2] || "")
                  }
                </p>

                <ul className="list-disc list-inside mb-6 text-gray-700 flex-grow">
                  {plan.features.map((feature, index) => (
                    <li key={index}>{feature}</li>
                  ))}
                </ul>
                <button
                  onClick={() => handleChoosePlan(plan.variantIdForCheckout, plan.name)}
                  // Disable if configError is present (storeDomain not set)
                  disabled={!!configError && plan.name !== 'Enterprise'}
                  className={`bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded w-full mt-auto ${(!!configError && plan.name !== 'Enterprise') ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {plan.name === 'Enterprise' ? 'Contact Sales' : `Choose ${plan.name}`}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
};

export default PricingPage;
