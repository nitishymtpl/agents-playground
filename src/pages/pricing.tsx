import React, { useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import Head from 'next/head';

// Define plan data, including placeholder Lemon Squeezy Variant IDs
const plans = [
  {
    id: 'plan_basic',
    name: 'Basic',
    description: 'Perfect for individuals starting out.',
    price: '$10',
    priceSuffix: '/mo',
    features: ['100 Credits/Month', 'Basic Feature 2', 'Basic Feature 3'],
    buttonText: 'Choose Basic',
    buttonClass: 'bg-blue-500 hover:bg-blue-700',
    popular: false,
  },
  {
    id: 'plan_pro',
    name: 'Pro',
    description: 'Ideal for professionals and small teams.',
    price: '$25',
    priceSuffix: '/mo',
    features: ['500 Credits/Month', 'Pro Feature 2', 'Pro Feature 3', 'Priority Support'],
    buttonText: 'Choose Pro',
    buttonClass: 'bg-green-500 hover:bg-green-700',
    popular: true,
  },
  {
    id: 'plan_enterprise',
    name: 'Enterprise',
    description: 'Tailored for large organizations.',
    price: 'Contact Us',
    priceSuffix: '',
    features: ['1500 Credits/Month', 'Custom Integrations', 'Dedicated Account Manager', '24/7 Support'],
    buttonText: 'Contact Sales',
    buttonClass: 'bg-purple-500 hover:bg-purple-700',
    popular: false,
  },
];

const PricingPage = () => {
  const { user, isSignedIn } = useUser();
  const storeDomain = process.env.NEXT_PUBLIC_LEMONSQUEEZY_STORE_DOMAIN;
  const isStoreDomainConfigured = storeDomain && storeDomain.trim() !== '';

  useEffect(() => {
    if (!isStoreDomainConfigured) {
      console.error(
        "Error: NEXT_PUBLIC_LEMONSQUEEZY_STORE_DOMAIN is not set. This is required for the pricing page to function correctly. Please check your environment variables."
      );
    }
  }, [isStoreDomainConfigured]);

  const handleChoosePlan = (variantId: string) => {
    if (!isSignedIn) {
      alert('Please sign in to choose a plan.');
      return;
    }

    if (!isStoreDomainConfigured) {
      // This alert is a fallback, primary error display is in JSX.
      alert("Subscription system is currently unavailable due to a configuration issue.");
      return;
    }

    if (variantId === 'plan_enterprise') {
        window.location.href = 'mailto:sales@example.com?subject=Enterprise Plan Inquiry';
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

        {!isStoreDomainConfigured && (
          <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md mb-8" role="alert">
            <p className="font-bold">Configuration Error</p>
            <p>The subscription system is currently unavailable. Please contact support if this issue persists.</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {plans.map((plan) => (
            <div key={plan.id} className="border p-6 rounded-lg shadow-lg relative flex flex-col">
              {plan.popular && (
                <div className="absolute top-0 left-1/2 transform -translate-x-1/2 bg-pink-500 text-white px-3 py-1 rounded-b-md text-sm font-semibold">
                  Most Popular
                </div>
              )}
              <h2 className={`text-2xl font-semibold mb-4 ${plan.popular ? 'mt-5' : ''}`}>{plan.name}</h2>
              <p className="text-gray-600 mb-6 flex-grow">{plan.description}</p>
              <p className="text-3xl font-bold mb-6">
                {plan.price}
                {plan.priceSuffix && <span className="text-sm font-normal">{plan.priceSuffix}</span>}
              </p>
              <ul className="list-disc list-inside mb-6 text-gray-700 flex-grow">
                {plan.features.map((feature, index) => (
                  <li key={index}>{feature}</li>
                ))}
              </ul>
              <button
                onClick={() => handleChoosePlan(plan.id)}
                disabled={!isStoreDomainConfigured && plan.id !== 'plan_enterprise'}
                className={`${plan.buttonClass} text-white font-bold py-2 px-4 rounded w-full mt-auto ${(!isStoreDomainConfigured && plan.id !== 'plan_enterprise') ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {plan.buttonText}
              </button>
            </div>
          ))}
        </div>
      </div>
    </>
  );
};

export default PricingPage;
