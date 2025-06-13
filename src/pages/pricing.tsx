import React from 'react';
import { NextPage } from 'next';
import Head from 'next/head';
// It's good practice to have a MainLayout or similar component for consistent page structure
// For now, we'll create a simple structure.
// import MainLayout from '@/components/layouts/MainLayout'; // Assuming you might have or create this

const PricingPage: NextPage = () => {
  // Placeholder data for pricing plans
  const plans = [
    {
      name: 'Basic',
      price: '$10/month',
      features: ['Feature 1', 'Feature 2', 'Feature 3'],
      checkoutUrl: '/api/create-checkout?plan=basic', // Example, will be dynamic
    },
    {
      name: 'Pro',
      price: '$20/month',
      features: ['All Basic features', 'Feature 4', 'Feature 5'],
      checkoutUrl: '/api/create-checkout?plan=pro', // Example, will be dynamic
    },
    {
      name: 'Premium',
      price: '$30/month',
      features: ['All Pro features', 'Feature 6', 'Priority Support'],
      checkoutUrl: '/api/create-checkout?plan=premium', // Example, will be dynamic
    },
  ];

  return (
    <>
      <Head>
        <title>Pricing Plans</title>
        <meta name="description" content="Choose a subscription plan that fits your needs." />
      </Head>
      {/* <MainLayout> */}
      <div style={{ padding: '2rem', fontFamily: 'Arial, sans-serif', textAlign: 'center' }}>
        <h1>Our Pricing Plans</h1>
        <p>Choose the plan that's right for you.</p>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', marginTop: '2rem', flexWrap: 'wrap' }}>
          {plans.map((plan) => (
            <div key={plan.name} style={{ border: '1px solid #ccc', borderRadius: '8px', padding: '2rem', width: '300px', boxShadow: '0 4px 8px rgba(0,0,0,0.1)' }}>
              <h2>{plan.name}</h2>
              <p style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{plan.price}</p>
              <ul style={{ listStyle: 'none', padding: 0, textAlign: 'left', marginTop: '1rem', marginBottom: '2rem' }}>
                {plan.features.map((feature, index) => (
                  <li key={index} style={{ marginBottom: '0.5rem' }}>✓ {feature}</li>
                ))}
              </ul>
              {/* In a real app, this would be a link or button that calls the create-checkout API */}
              <a
                href={plan.checkoutUrl}
                style={{
                  display: 'inline-block',
                  padding: '0.75rem 1.5rem',
                  backgroundColor: '#0070f3',
                  color: 'white',
                  textDecoration: 'none',
                  borderRadius: '5px',
                  fontWeight: 'bold'
                }}
              >
                Subscribe to {plan.name}
              </a>
            </div>
          ))}
        </div>
      </div>
      {/* </MainLayout> */}
    </>
  );
};

export default PricingPage;
