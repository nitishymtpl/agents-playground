import React from 'react';
import { NextPage } from 'next';
import Head from 'next/head';
import { useUser } from '@clerk/nextjs'; // For potential client-side checks or display

const PremiumContentPage: NextPage = () => {
  const { user } = useUser();

  return (
    <>
      <Head>
        <title>Premium Content</title>
        <meta name="description" content="Exclusive content for subscribers." />
      </Head>
      <div style={{ padding: '2rem', fontFamily: 'Arial, sans-serif', textAlign: 'center' }}>
        <h1>✨ Premium Content ✨</h1>
        <p>This page contains exclusive content available only to our active subscribers.</p>
        {user && <p>Welcome, {user.firstName || user.emailAddresses[0]?.emailAddress}!</p>}
        <div style={{ marginTop: '2rem', padding: '1rem', border: '1px dashed #ccc', backgroundColor: '#f9f9f9' }}>
          <p>Imagine some really awesome, valuable content here!</p>
        </div>
      </div>
    </>
  );
};

export default PremiumContentPage;
