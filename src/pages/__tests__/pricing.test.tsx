import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import PricingPage from '../pricing'; // Adjust path as necessary
import { useUser } from '@clerk/nextjs';

// Mock Clerk's useUser hook
jest.mock('@clerk/nextjs', () => ({
  useUser: jest.fn(),
}));

// Mock environment variable
const mockStoreDomain = 'teststore.lemonsqueezy.com';
process.env.NEXT_PUBLIC_LEMONSQUEEZY_STORE_DOMAIN = mockStoreDomain;

describe('PricingPage', () => {
  let mockWindowLocationHref: jest.SpyInstance;

  beforeEach(() => {
    // Mock window.location.href
    mockWindowLocationHref = jest.spyOn(window.location, 'href', 'get');
    jest.spyOn(window.location, 'href', 'set').mockImplementation(url => mockWindowLocationHref(url));

    // Default mock for useUser
    (useUser as jest.Mock).mockReturnValue({
      user: { id: 'user_test123' },
      isSignedIn: true,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders pricing plans correctly', () => {
    render(<PricingPage />);
    expect(screen.getByText('Our Pricing Plans')).toBeInTheDocument();
    expect(screen.getByText('Basic')).toBeInTheDocument();
    expect(screen.getByText('Pro')).toBeInTheDocument();
    expect(screen.getByText('Enterprise')).toBeInTheDocument();
  });

  it('constructs correct checkout URL and redirects for a basic plan when user is signed in', () => {
    render(<PricingPage />);
    const basicPlanButton = screen.getByRole('button', { name: 'Choose Basic' });
    fireEvent.click(basicPlanButton);

    const expectedUrl = `https://${mockStoreDomain}/checkout/buy/plan_basic?checkout[custom][clerk_user_id]=user_test123`;
    expect(window.location.href).toBe(expectedUrl);
  });

  it('constructs correct checkout URL for pro plan without clerk_user_id if user is not signed in (though UI might prevent this)', () => {
    (useUser as jest.Mock).mockReturnValue({
      user: null,
      isSignedIn: false, // Simulate signed out user
    });

    // Mock alert since the component calls it when not signed in
    jest.spyOn(window, 'alert').mockImplementation(()_ => {});

    render(<PricingPage />);
    const proPlanButton = screen.getByRole('button', { name: 'Choose Pro' });
    fireEvent.click(proPlanButton);

    // Expect alert to be called because user is not signed in
    expect(window.alert).toHaveBeenCalledWith('Please sign in to choose a plan.');
    // window.location.href should not be called in this case
    expect(mockWindowLocationHref).not.toHaveBeenCalled();
  });

  it('handles "Contact Sales" for Enterprise plan', () => {
    render(<PricingPage />);
    const enterprisePlanButton = screen.getByRole('button', { name: 'Contact Sales' });
    fireEvent.click(enterprisePlanButton);
    expect(window.location.href).toBe('mailto:sales@example.com?subject=Enterprise Plan Inquiry');
  });

  it('shows configuration error if store domain is not set', () => {
    process.env.NEXT_PUBLIC_LEMONSQUEEZY_STORE_DOMAIN = ''; // Simulate not set
    render(<PricingPage />);
    expect(screen.getByText('Configuration Error:')).toBeInTheDocument();
    // Buttons should be disabled (except enterprise)
    const basicPlanButton = screen.getByRole('button', { name: 'Choose Basic' });
    expect(basicPlanButton).toBeDisabled();
    const proPlanButton = screen.getByRole('button', { name: 'Choose Pro' });
    expect(proPlanButton).toBeDisabled();
    const enterprisePlanButton = screen.getByRole('button', { name: 'Contact Sales' });
    expect(enterprisePlanButton).not.toBeDisabled(); // Contact Sales should still work
    process.env.NEXT_PUBLIC_LEMONSQUEEZY_STORE_DOMAIN = mockStoreDomain; // Reset for other tests
  });

  it('alerts and does not redirect if store domain is missing and a plan is chosen', () => {
    process.env.NEXT_PUBLIC_LEMONSQUEEZY_STORE_DOMAIN = '';
    jest.spyOn(window, 'alert').mockImplementation(() => {});
    render(<PricingPage />);
    const proPlanButton = screen.getByRole('button', { name: 'Choose Pro' });
    fireEvent.click(proPlanButton);

    expect(window.alert).toHaveBeenCalledWith('Subscription system is currently unavailable. Please try again later.');
    expect(mockWindowLocationHref).not.toHaveBeenCalled();
    process.env.NEXT_PUBLIC_LEMONSQUEEZY_STORE_DOMAIN = mockStoreDomain; // Reset
  });
});
