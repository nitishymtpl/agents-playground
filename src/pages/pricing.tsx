import React from 'react';
// import Link from 'next/link'; // Not strictly needed if buttons redirect directly
import { useUser } from '@clerk/nextjs';
import Head from 'next/head';

// Define plan data, including placeholder Lemon Squeezy Variant IDs
const basicVariantId = process.env.NEXT_PUBLIC_LEMONSQUEEZY_BASIC_VARIANT_ID || 'plan_basic_fallback';
const proVariantId = process.env.NEXT_PUBLIC_LEMONSQUEEZY_PRO_VARIANT_ID || 'plan_pro_fallback';

const plans = [
  {
    id: basicVariantId, // Use actual Lemon Squeezy Variant ID from env
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
    id: proVariantId, // Use actual Lemon Squeezy Variant ID from env
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
    id: 'plan_enterprise', // This plan might not have a typical variant ID if it's "Contact Us"
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

  const handleChoosePlan = (variantId: string) => {
    if (!isSignedIn) {
      // Optionally, redirect to sign-in or show a message
      alert('Please sign in to choose a plan.');
      // router.push('/sign-in'); // if using next/router
      return;
    }

    if (!storeDomain) {
      console.error("Lemon Squeezy store domain is not configured in environment variables (NEXT_PUBLIC_LEMONSQUEEZY_STORE_DOMAIN).");
      alert("Subscription system is currently unavailable. Please try again later.");
      return;
    }

    if (variantId === 'plan_enterprise') { // Or however you identify a "Contact Us" plan
        // Redirect to a contact page or open mailto link
        window.location.href = 'mailto:sales@example.com?subject=Enterprise Plan Inquiry';
        return;
    }

    // Construct the Lemon Squeezy checkout URL
    // Note: Variant IDs are now sourced from environment variables for Basic and Pro plans.
    // The 'plan_enterprise' ID is handled as a special case.
    let checkoutUrl = `https://${storeDomain}/checkout/buy/${variantId}`;

    if (user?.id) {
      checkoutUrl += `?checkout[custom][clerk_user_id]=${user.id}`;
    } else {
      // This case should ideally be handled by the `!isSignedIn` check,
      // but as a fallback, log a warning if user.id is somehow not available.
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
        {!storeDomain && (
          <div className="text-center bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-6" role="alert">
            <strong className="font-bold">Configuration Error:</strong>
            <span className="block sm:inline"> The subscription system is currently unavailable. Please contact support.</span>
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
                disabled={!storeDomain && plan.id !== 'plan_enterprise'} // Disable if store domain not set, except for "Contact Us"
                className={`${plan.buttonClass} text-white font-bold py-2 px-4 rounded w-full mt-auto ${(!storeDomain && plan.id !== 'plan_enterprise') ? 'opacity-50 cursor-not-allowed' : ''}`}
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
