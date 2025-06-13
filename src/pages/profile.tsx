import React from 'react';
import { NextPage } from 'next';
import Head from 'next/head';
import { useUser, UserProfile } from '@clerk/nextjs'; // UserProfile can be used for full profile management
import { useRouter } from 'next/router';

// Define a type for the expected metadata structure from Clerk for clarity
interface UserSubscriptionMetadata {
  lemonSqueezySubscriptionId?: string | null;
  lemonSqueezyPlanId?: string | null;
  lemonSqueezyVariantName?: string | null;
  lemonSqueezySubscriptionStatus?: string | null;
  lemonSqueezySubscriptionEndDate?: string | null;
  lemonSqueezyRenewsAt?: string | null;
  lemonSqueezyCustomerId?: string | null;
  lemonSqueezyCustomerPortalUrl?: string | null;
}

const ProfilePage: NextPage = () => {
  const { isLoaded, isSignedIn, user } = useUser();
  const router = useRouter();

  // If user is not loaded or not signed in, redirect to sign-in
  // This can also be handled by Clerk's middleware for better protection
  React.useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push('/sign-in');
    }
  }, [isLoaded, isSignedIn, router]);

  if (!isLoaded || !isSignedIn || !user) {
    // You can render a loading state here
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p>Loading user profile...</p>
      </div>
    );
  }

  // Type assertion for publicMetadata
  const subscriptionMetadata = user.publicMetadata as UserSubscriptionMetadata;

  return (
    <>
      <Head>
        <title>My Profile & Subscription</title>
        <meta name="description" content="View your profile and subscription details." />
      </Head>
      <div style={{ padding: '2rem', fontFamily: 'Arial, sans-serif', maxWidth: '800px', margin: 'auto' }}>
        <h1>My Profile</h1>
        {/* You can embed Clerk's UserProfile component for full profile editing */}
        {/* <UserProfile path="/profile" routing="path" /> */}

        <h2 style={{ marginTop: '2rem' }}>My Subscription</h2>
        {subscriptionMetadata && subscriptionMetadata.lemonSqueezySubscriptionId ? (
          <div style={{ border: '1px solid #eee', padding: '1rem', borderRadius: '8px' }}>
            <p><strong>Plan:</strong> {subscriptionMetadata.lemonSqueezyVariantName || 'N/A'}</p>
            <p><strong>Status:</strong> {subscriptionMetadata.lemonSqueezySubscriptionStatus || 'N/A'}</p>
            {subscriptionMetadata.lemonSqueezySubscriptionStatus === 'active' && subscriptionMetadata.lemonSqueezyRenewsAt && (
              <p><strong>Renews At:</strong> {new Date(subscriptionMetadata.lemonSqueezyRenewsAt).toLocaleDateString()}</p>
            )}
            {subscriptionMetadata.lemonSqueezySubscriptionEndDate && (
              <p><strong>Ends At:</strong> {new Date(subscriptionMetadata.lemonSqueezySubscriptionEndDate).toLocaleDateString()}</p>
            )}
            <p><strong>Subscription ID:</strong> {subscriptionMetadata.lemonSqueezySubscriptionId}</p>

            {subscriptionMetadata.lemonSqueezyCustomerPortalUrl ? (
              <a
                href={subscriptionMetadata.lemonSqueezyCustomerPortalUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-block',
                  marginTop: '1rem',
                  padding: '0.75rem 1.5rem',
                  backgroundColor: '#0070f3',
                  color: 'white',
                  textDecoration: 'none',
                  borderRadius: '5px',
                  fontWeight: 'bold',
                }}
              >
                Manage Subscription
              </a>
            ) : (
              <p style={{marginTop: '1rem'}}><em>Subscription management link not available.</em></p>
            )}
          </div>
        ) : (
          <p>You do not have an active subscription. <a href="/pricing" style={{color: '#0070f3'}}>View Pricing Plans</a></p>
        )}
      </div>
    </>
  );
};

export default ProfilePage;
