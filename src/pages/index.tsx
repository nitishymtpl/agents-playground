import React from 'react';
import { NextPage } from 'next';
import Head from 'next/head';
import { useUser, SignInButton, UserButton } from '@clerk/nextjs'; // Added UserButton
import Link from 'next/link'; // For navigation links

// Define a type for the expected metadata structure from Clerk for clarity
interface UserSubscriptionMetadata {
  lemonSqueezySubscriptionStatus?: string | null;
  // Add other fields if you need to display them here
  lemonSqueezyVariantName?: string | null;
}

const HomePage: NextPage = () => {
  const { isSignedIn, user, isLoaded } = useUser();

  // Type assertion for publicMetadata if user is available
  const subscriptionMetadata = user?.publicMetadata as UserSubscriptionMetadata | undefined;
  const isActiveSubscriber = subscriptionMetadata?.lemonSqueezySubscriptionStatus === 'active';

  return (
    <>
      <Head>
        <title>My Awesome App</title>
        <meta name="description" content="Welcome to the application." />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <header style={{ padding: '1rem 2rem', backgroundColor: '#f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>My App</h1>
        <div>
          {isLoaded && isSignedIn && (
            <>
              <Link href="/profile" style={{ marginRight: '1rem', color: '#0070f3' }}>Profile</Link>
              <Link href="/pricing" style={{ marginRight: '1rem', color: '#0070f3' }}>Pricing</Link>
              <UserButton afterSignOutUrl="/" />
            </>
          )}
          {isLoaded && !isSignedIn && (
            <SignInButton mode="modal">
              <button style={{ padding: '0.5rem 1rem', backgroundColor: '#0070f3', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>
                Sign In
              </button>
            </SignInButton>
          )}
        </div>
      </header>

      <main style={{ padding: '2rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '2rem' }}>
          Welcome to Our Application!
        </h1>

        {!isLoaded && <p>Loading authentication status...</p>}

        {isLoaded && isSignedIn && (
          <div style={{ marginBottom: '2rem' }}>
            <p>Hello, {user?.firstName || user?.emailAddresses[0]?.emailAddress}!</p>
            <p>You are signed in.</p>

            {/* Component-level protection based on subscription */}
            {isActiveSubscriber ? (
              <div style={{ marginTop: '1.5rem', padding: '1rem', backgroundColor: '#e6ffed', border: '1px solid #b7e4c7', borderRadius: '8px' }}>
                <h2>🎉 You're a Premium Subscriber! 🎉</h2>
                <p>Thank you for subscribing to the <strong>{subscriptionMetadata?.lemonSqueezyVariantName || 'Premium'}</strong> plan.</p>
                <p>Here's a special feature only for you: <button onClick={() => alert('Super Secret Feature Activated!')}>Activate Secret Feature</button></p>
                <p><Link href="/premium-content" style={{color: '#0070f3'}}>Access your Premium Content</Link></p>
              </div>
            ) : (
              <div style={{ marginTop: '1.5rem', padding: '1rem', backgroundColor: '#fff3e0', border: '1px solid #ffcc80', borderRadius: '8px' }}>
                <h3>Want more?</h3>
                <p>You are currently not on an active premium plan.</p>
                <p><Link href="/pricing" style={{color: '#0070f3', fontWeight: 'bold'}}>Upgrade to a Premium Plan</Link> to unlock exclusive features and content!</p>
              </div>
            )}
          </div>
        )}

        {isLoaded && !isSignedIn && (
          <p>Please <SignInButton mode="modal"><strong style={{color: '#0070f3', cursor: 'pointer'}}>sign in</strong></SignInButton> to access more features and manage your account.</p>
        )}

        <section style={{ marginTop: '3rem' }}>
          <h2>About Our App</h2>
          <p>This is a generic landing page content. You can replace this with information about your application.</p>
        </section>
      </main>
    </>
  );
};

export default HomePage;