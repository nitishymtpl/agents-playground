import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PricingPage, { Plan } from '../pricing'; // Adjust path, import Plan type
import { useUser } from '@clerk/nextjs';

// Mock Clerk's useUser hook
jest.mock('@clerk/nextjs', () => ({
  useUser: jest.fn(),
}));

// Mock environment variable
const mockStoreDomain = 'teststore.lemonsqueezy.com';
const originalStoreDomain = process.env.NEXT_PUBLIC_LEMONSQUEEZY_STORE_DOMAIN;

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('PricingPage', () => {
  let mockWindowLocationHref: jest.SpyInstance<string | void, [url?: string | URL | undefined]>;


  beforeEach(() => {
    process.env.NEXT_PUBLIC_LEMONSQUEEZY_STORE_DOMAIN = mockStoreDomain;
    // Mock window.location.href
    // Correct way to mock window.location.href for both read and write
    const location = window.location;
    // @ts-ignore
    delete window.location;
    // @ts-ignore
    window.location = { ...location, href: '' }; // Initialize href
    mockWindowLocationHref = jest.spyOn(window.location, 'href', 'set');

    // Default mock for useUser
    (useUser as jest.Mock).mockReturnValue({
      user: { id: 'user_test123' },
      isSignedIn: true,
    });
    mockFetch.mockClear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    process.env.NEXT_PUBLIC_LEMONSQUEEZY_STORE_DOMAIN = originalStoreDomain;
  });

  it('shows loading state initially', async () => {
    mockFetch.mockReturnValueOnce(new Promise(() => {})); // Promise that never resolves
    render(<PricingPage />);
    expect(screen.getByText('Loading plans...')).toBeInTheDocument();
  });

  it('shows error state if API fetch fails', async () => {
    mockFetch.mockRejectedValueOnce(new Error('API is down'));
    render(<PricingPage />);
    await waitFor(() => {
      expect(screen.getByText('Error Loading Plans')).toBeInTheDocument();
      expect(screen.getByText(/API is down/)).toBeInTheDocument();
    });
  });

  it('shows error state if API returns non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      statusText: 'Server Error',
      json: async () => ({ error: 'Internal Server Error' }),
    } as Response);
    render(<PricingPage />);
    await waitFor(() => {
      expect(screen.getByText('Error Loading Plans')).toBeInTheDocument();
      expect(screen.getByText(/Internal Server Error/)).toBeInTheDocument();
    });
  });

  it('displays plans correctly after successful fetch', async () => {
    const mockPlans: Plan[] = [
      { id: 'var_basic_123', name: 'Basic Test Plan', productName: 'Test Product', priceFormatted: '$10.00 USD/month', price: 1000, currency: 'USD', period: 'month', features: ['Feat 1', 'Feat 2'], sort: 1, variantIdForCheckout: 'var_basic_123' },
      { id: 'var_pro_456', name: 'Pro Test Plan', productName: 'Test Product Pro', priceFormatted: '$25.00 USD/month', price: 2500, currency: 'USD', period: 'month', features: ['Feat A', 'Feat B'], sort: 2, variantIdForCheckout: 'var_pro_456' },
    ];
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockPlans,
    } as Response);

    render(<PricingPage />);

    await waitFor(() => {
      expect(screen.getByText('Basic Test Plan')).toBeInTheDocument();
      expect(screen.getByText('Pro Test Plan')).toBeInTheDocument();
    });

    expect(screen.getByText('$10.00')).toBeInTheDocument(); // Check price part
    expect(screen.getByText('USD /month')).toBeInTheDocument(); // Check currency/period part

    // Test button click for the first plan
    const chooseBasicButton = screen.getByRole('button', { name: 'Choose Basic Test Plan' });
    fireEvent.click(chooseBasicButton);
    expect(mockWindowLocationHref).toHaveBeenCalledWith(
      `https://${mockStoreDomain}/checkout/buy/var_basic_123?checkout[custom][clerk_user_id]=user_test123`
    );
  });

  it('shows "no plans available" message if API returns empty array', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    } as Response);
    render(<PricingPage />);
    await waitFor(() => {
      expect(screen.getByText('No pricing plans are currently available. Please check back later.')).toBeInTheDocument();
    });
  });

  it('shows configuration error if store domain is not set and takes precedence', async () => {
    process.env.NEXT_PUBLIC_LEMONSQUEEZY_STORE_DOMAIN = ''; // Simulate not set
    render(<PricingPage />);

    // Need to wait for useEffect to run and set state
    await waitFor(() => {
        expect(screen.getByText('Configuration Error')).toBeInTheDocument();
        expect(screen.getByText(/The subscription system is currently unavailable/)).toBeInTheDocument();
    });

    expect(mockFetch).not.toHaveBeenCalled(); // API fetch should not be attempted

    // Buttons should be disabled (except enterprise which is not in this test's mock data)
    // To test this properly, we need plans to be rendered, which won't happen if config error shown first.
    // The component logic already disables buttons based on configError, which is good.
    // For this specific test, confirming the config error message is primary.
  });

  // Keep existing tests for signed out users and Enterprise plan handling
  it('alerts if user is not signed in when choosing a plan', async () => {
    mockFetch.mockResolvedValueOnce({ // Mock a successful fetch so plans render
        ok: true,
        json: async () => [{ id: 'var_basic_123', name: 'Basic Plan', productName: 'Test', priceFormatted: '$10 /mo', price:1000, currency:'USD', period:'month', features: [], sort:1, variantIdForCheckout: 'var_basic_123' }],
      } as Response);
    (useUser as jest.Mock).mockReturnValue({ user: null, isSignedIn: false });
    jest.spyOn(window, 'alert').mockImplementation(() => {});

    render(<PricingPage />);
    await waitFor(() => screen.getByText('Basic Plan')); // Wait for plans to render

    const basicPlanButton = screen.getByRole('button', { name: 'Choose Basic Plan' });
    fireEvent.click(basicPlanButton);

    expect(window.alert).toHaveBeenCalledWith('Please sign in to choose a plan.');
    expect(mockWindowLocationHref).not.toHaveBeenCalled();
  });

  it('handles "Contact Sales" for Enterprise plan (if Enterprise plan is fetched)', async () => {
    mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [{ id: 'var_enterprise', name: 'Enterprise', productName: 'Test Ent', priceFormatted: 'Contact Us', price:0, currency:'', features: [], sort:3, variantIdForCheckout: 'var_enterprise' }],
      } as Response);

    render(<PricingPage />);
    await waitFor(() => screen.getByText('Enterprise'));

    const enterprisePlanButton = screen.getByRole('button', { name: 'Contact Sales' });
    fireEvent.click(enterprisePlanButton);
    expect(mockWindowLocationHref).toHaveBeenCalledWith('mailto:sales@example.com?subject=Enterprise Plan Inquiry');
  });

});
