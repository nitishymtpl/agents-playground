import { NextPage, GetServerSideProps } from 'next';
import { LemonSqueezy } from '@lemonsqueezy/lemonsqueezy.js';
import { useUser, SignInButton } from '@clerk/nextjs';
import { useRouter } from 'next/router';
import { useState, useEffect } from 'react';

// Define the structure for a Lemon Squeezy Variant (Plan)
interface Variant {
  id: string;
  type: string;
  attributes: {
    name: string;
    description: string;
    price: number;
    is_subscription: boolean;
    interval: string | null;
    interval_count: number | null;
    has_free_trial: boolean;
    trial_interval: string | null;
    trial_interval_count: number | null;
    sort: number;
    status: string; // 'published', 'draft', 'archived'
    [key: string]: any;
  };
}

// Define structure for subscription data stored in Clerk's publicMetadata
interface LemonSqueezySubscriptionMetadata {
  status?: string | null; // e.g., 'active', 'on_trial', 'cancelled', 'expired', 'past_due', 'unpaid'
  subscriptionId?: string | null;
  orderId?: string | null;
  productId?: string | null;
  variantId?: string | null;
  renewsAt?: string | null;
  endsAt?: string | null;
  trialEndsAt?: string | null;
  customerPortalUpdateUrl?: string; // URL to update payment method
  customerPortalUrl?: string; // URL to the customer portal
  variantName?: string; // Store variant name for easy display
  [key: string]: any;
}

interface SubscribePageProps {
  plans: Variant[];
  error?: string;
  appName?: string; // For redirect URLs
}

const SubscribePage: NextPage<SubscribePageProps> = ({ plans, error, appName }) => {
  const { user, isSignedIn, isLoaded } = useUser();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // Explicitly type the subscription data from Clerk metadata
  const lemonSqueezySubscription = user?.publicMetadata?.lemonSqueezySubscription as LemonSqueezySubscriptionMetadata | undefined;

  // Refresh user data to get latest metadata after potential updates
  useEffect(() => {
    if (router.query.checkout === 'success' || router.query.subscription_updated === 'true') {
      user?.reload();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.query, user?.reload]);


  const handleSubscribe = async (variantId: string) => {
    setIsLoading(true);
    setApiError(null);

    if (!isSignedIn || !user) {
      router.push(`/sign-in?redirect_url=${encodeURIComponent(router.asPath)}`);
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/lemonsqueezy/create-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        // Pass the variant name for storage in metadata by the webhook
        body: JSON.stringify({
            variantId,
            userId: user.id,
            redirectUrl: `${window.location.origin}${router.pathname}?checkout=success`,
            // productName: plans.find(p => p.id === variantId)?.attributes.name // Not strictly needed here if webhook fetches it
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to create checkout session.');
      }

      if (data.checkoutUrl) {
        router.push(data.checkoutUrl);
      } else {
        throw new Error('Checkout URL not found in response.');
      }
    } catch (err: any) {
      console.error('Subscription error:', err);
      setApiError(err.message || 'An unexpected error occurred.');
      setIsLoading(false);
    }
  };

  const handleManageSubscription = () => {
    if (lemonSqueezySubscription?.customerPortalUrl) {
      router.push(lemonSqueezySubscription.customerPortalUrl);
    } else {
      // Fallback or message if URL is not available
      setApiError('Management portal URL not available. Please contact support.');
    }
  };

  if (error) {
    return (
      <div style={{ padding: '20px', color: 'red', textAlign: 'center' }}>
        <h1>Error loading subscription plans</h1>
        <p>{error}</p>
      </div>
    );
  }

  if (!isLoaded) {
    return <div style={{ padding: '20px', textAlign: 'center' }}>Loading user session...</div>;
  }

  const isActiveSubscription = lemonSqueezySubscription?.status === 'active' || lemonSqueezySubscription?.status === 'on_trial';

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1 style={{ textAlign: 'center', marginBottom: '30px' }}>{appName ? `${appName} Subscriptions` : 'Subscriptions'}</h1>

      {apiError && <p style={{ color: 'red', textAlign: 'center', marginBottom: '20px' }}>{apiError}</p>}
      {router.query.checkout === 'success' && !isActiveSubscription && (
        <p style={{ color: 'green', textAlign: 'center', marginBottom: '20px' }}>
          Checkout successful! Your subscription details are being updated. Please wait a moment and this page will refresh.
        </p>
      )}
       {router.query.checkout === 'success' && isActiveSubscription && (
        <p style={{ color: 'green', textAlign: 'center', marginBottom: '20px' }}>
          Welcome! Your subscription is now active.
        </p>
      )}
      {router.query.checkout === 'cancelled' && (
        <p style={{ color: 'orange', textAlign: 'center', marginBottom: '20px' }}>
          Checkout was cancelled. You can choose a plan and try again anytime.
        </p>
      )}

      {!isSignedIn && (
        <div style={{ textAlign: 'center', padding: '30px', border: '1px solid #eee', borderRadius: '8px' }}>
          <h2>Sign in to Manage Subscriptions</h2>
          <p>Please sign in to view available plans or manage your existing subscription.</p>
          <SignInButton mode="modal" redirectUrl={router.asPath}>
            <button style={{ padding: '10px 20px', fontSize: '16px', backgroundColor: '#0070f3', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>
              Sign In
            </button>
          </SignInButton>
        </div>
      )}

      {isSignedIn && lemonSqueezySubscription && (
        <div style={{ padding: '20px', border: '1px solid #eee', borderRadius: '8px', marginBottom: '30px', backgroundColor: '#f9f9f9' }}>
          <h2 style={{ marginTop: '0' }}>Your Current Subscription</h2>
          <p><strong>Plan:</strong> {lemonSqueezySubscription.variantName || 'N/A'}</p>
          <p><strong>Status:</strong> <span style={{ fontWeight: 'bold', color: isActiveSubscription ? 'green' : 'orange' }}>{lemonSqueezySubscription.status?.replace('_', ' ').toUpperCase()}</span></p>
          {lemonSqueezySubscription.renewsAt && isActiveSubscription && (
            <p><strong>Renews At:</strong> {new Date(lemonSqueezySubscription.renewsAt).toLocaleDateString()}</p>
          )}
          {lemonSqueezySubscription.endsAt && (
            <p><strong>Ends At:</strong> {new Date(lemonSqueezySubscription.endsAt).toLocaleDateString()}</p>
          )}
          {lemonSqueezySubscription.trialEndsAt && lemonSqueezySubscription.status === 'on_trial' && (
            <p><strong>Trial Ends At:</strong> {new Date(lemonSqueezySubscription.trialEndsAt).toLocaleDateString()}</p>
          )}

          {lemonSqueezySubscription.customerPortalUrl ? (
            <button
              onClick={handleManageSubscription}
              style={{ padding: '10px 15px', backgroundColor: '#5cb85c', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', marginTop: '10px' }}
            >
              Manage Subscription
            </button>
          ) : (
            <p style={{fontSize: '0.9em', color: '#555'}}>To manage your subscription, please check your emails from Lemon Squeezy or contact support.</p>
          )}
        </div>
      )}

      {isSignedIn && !isActiveSubscription && (
        <>
          <h2 style={{ textAlign: 'center', marginBottom: '20px' }}>{plans.length > 0 ? "Choose Your Plan" : "No Subscription Plans Available"}</h2>
          {plans.length === 0 && !error && <p style={{textAlign: 'center'}}>No subscription plans available at the moment. Please check back later.</p>}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
            {plans.map((plan) => (
              <div key={plan.id} style={{ border: '1px solid #ccc', padding: '25px', borderRadius: '8px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <h3 style={{ marginTop: '0', color: '#333' }}>{plan.attributes.name}</h3>
                  <div dangerouslySetInnerHTML={{ __html: plan.attributes.description || 'No description available.' }} style={{ color: '#555', marginBottom: '15px', minHeight: '50px' }} />
                  <p style={{ fontSize: '1.8em', fontWeight: 'bold', color: '#0070f3', margin: '10px 0' }}>
                    ${(plan.attributes.price / 100).toFixed(2)}
                    {plan.attributes.is_subscription && plan.attributes.interval ? ` / ${plan.attributes.interval}` : ''}
                  </p>
                  {plan.attributes.has_free_trial && (
                      <p style={{ color: 'green' }}>Free trial: {plan.attributes.trial_interval_count} {plan.attributes.trial_interval}(s)</p>
                  )}
                </div>
                <button
                  onClick={() => handleSubscribe(plan.id)}
                  disabled={isLoading}
                  style={{ padding: '12px 18px', fontSize: '16px', backgroundColor: '#0070f3', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', marginTop: '15px', width: '100%' }}
                >
                  {isLoading ? 'Processing...' : 'Subscribe'}
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export const getServerSideProps: GetServerSideProps = async () => {
  const lemonsqueezyApiKey = process.env.LEMONSQUEEZY_API_KEY;
  const lemonsqueezyStoreId = process.env.LEMONSQUEEZY_STORE_ID;
  const appName = process.env.NEXT_PUBLIC_APP_TITLE || 'Your App'; // Example of getting app name

  if (!lemonsqueezyApiKey || !lemonsqueezyStoreId) {
    console.error('Lemon Squeezy API Key or Store ID is not set for getServerSideProps.');
    return { props: { plans: [], error: 'Server configuration error: Missing Lemon Squeezy credentials.', appName } };
  }

  try {
    const ls = new LemonSqueezy(lemonsqueezyApiKey);
    const response = await ls.listVariants({
      storeId: parseInt(lemonsqueezyStoreId),
      // Optionally filter by product ID if you have multiple products:
      // productId: process.env.LEMONSQUEEZY_PRODUCT_ID
    });

    if (response.error) {
        throw new Error(response.error.message || 'Failed to fetch plans from Lemon Squeezy.');
    }

    // Filter for published subscription plans, you might want to adjust this (e.g. include one-time purchases if needed)
    const plans = (response.data || [])
      .filter((variant: Variant) => variant.attributes.status === 'published' && variant.attributes.is_subscription)
      .sort((a: Variant, b: Variant) => a.attributes.sort - b.attributes.sort); // Sort by 'sort' attribute

    return { props: { plans, appName } };
  } catch (error: any) {
    console.error('Error fetching Lemon Squeezy plans:', error);
    return { props: { plans: [], error: error.message || 'Failed to load subscription plans.', appName } };
  }
};

export default SubscribePage;
