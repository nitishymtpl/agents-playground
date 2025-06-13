import React from 'react';
import { PricingTable, SignedIn, SignedOut, RedirectToSignIn } from '@clerk/nextjs';

const SubscribePage = () => {
  return (
    <div>
      <h1>Manage Your Subscription</h1>
      <SignedIn>
        <PricingTable pricingTableId="YOUR_PRICING_TABLE_ID" />
      </SignedIn>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
    </div>
  );
};

export default SubscribePage;
