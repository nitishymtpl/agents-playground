import React from 'react';
import { render, screen } from '@testing-library/react';
import { PlaygroundHeader } from '../PlaygroundHeader'; // Adjust path as necessary
import { useUser } from '@clerk/nextjs';
import { useConfig } from '@/hooks/useConfig'; // Mock this if its default value causes issues

// Mock Clerk's useUser hook
jest.mock('@clerk/nextjs', () => ({
  useUser: jest.fn(),
  UserButton: () => <div data-testid="user-button-mock">UserButton</div>, // Mock UserButton
}));

// Mock useConfig hook
jest.mock('@/hooks/useConfig', () => ({
  useConfig: jest.fn(),
}));

// Mock next/link
jest.mock('next/link', () => ({ children, href }: { children: React.ReactNode, href: string }) => <a href={href}>{children}</a>);


describe('PlaygroundHeader', () => {
  const defaultProps = {
    title: 'Test Title',
    githubLink: 'https://github.com/test',
    height: 60,
    accentColor: 'cyan',
    connectionState: 'Disconnected' as any, // ConnectionState type
    onConnectClicked: jest.fn(),
  };

  beforeEach(() => {
    // Default mock for useUser
    (useUser as jest.Mock).mockReturnValue({
      user: null,
      isSignedIn: false,
    });
    // Default mock for useConfig
    (useConfig as jest.Mock).mockReturnValue({
      config: {
        title: 'Default Config Title',
        description: 'Default Config Desc',
        github_link: 'https://config.github.com',
        settings: { editable: true },
      },
    });
  });

  it('renders basic elements like title and GitHub link', () => {
    render(<PlaygroundHeader {...defaultProps} />);
    expect(screen.getByText('Test Title')).toBeInTheDocument();
    expect(screen.getByTitle('GitHub Repository')).toHaveAttribute('href', 'https://github.com/test');
    expect(screen.getByTitle('Pricing')).toBeInTheDocument();
  });

  describe('Subscription Information Display', () => {
    it('shows default values when user is not signed in', () => {
      render(<PlaygroundHeader {...defaultProps} />);
      // Subscription info is not rendered if not signed in based on current implementation
      expect(screen.queryByText(/Plan:/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Credits:/)).not.toBeInTheDocument();
    });

    it('shows default values when user is signed in but has no metadata', () => {
      (useUser as jest.Mock).mockReturnValue({
        user: { id: 'user_test123', publicMetadata: {} },
        isSignedIn: true,
      });
      render(<PlaygroundHeader {...defaultProps} />);
      expect(screen.getByText(/Plan:/)).toHaveTextContent('Plan: Free Tier (Status: N/A)');
      expect(screen.getByText(/Credits:/)).toHaveTextContent('Credits: 0');
    });

    it('displays correct plan name, status, and credits from metadata', () => {
      (useUser as jest.Mock).mockReturnValue({
        user: {
          id: 'user_test123',
          publicMetadata: {
            lemonSqueezyPlanId: 'plan_pro',
            lemonSqueezyStatus: 'active',
            creditsAvailable: 450,
          },
        },
        isSignedIn: true,
      });
      render(<PlaygroundHeader {...defaultProps} />);
      expect(screen.getByText(/Plan:/)).toHaveTextContent('Plan: Pro Plan (Status: active)');
      expect(screen.getByText(/Credits:/)).toHaveTextContent('Credits: 450');
    });

    it('displays plan ID if name mapping is missing', () => {
        (useUser as jest.Mock).mockReturnValue({
          user: {
            id: 'user_test123',
            publicMetadata: {
              lemonSqueezyPlanId: 'some_unknown_plan_id',
              lemonSqueezyStatus: 'active',
              creditsAvailable: 100,
            },
          },
          isSignedIn: true,
        });
        render(<PlaygroundHeader {...defaultProps} />);
        expect(screen.getByText(/Plan:/)).toHaveTextContent('Plan: some_unknown_plan_id (Status: active)');
      });
  });

  describe('Manage Subscription Button', () => {
    it('does not display "Manage Subscription" button if URL is not in metadata', () => {
      (useUser as jest.Mock).mockReturnValue({
        user: { id: 'user_test123', publicMetadata: {} },
        isSignedIn: true,
      });
      render(<PlaygroundHeader {...defaultProps} />);
      expect(screen.queryByText('Manage Subscription')).not.toBeInTheDocument();
    });

    it('does not display "Manage Subscription" button if URL is invalid', () => {
      (useUser as jest.Mock).mockReturnValue({
        user: {
          id: 'user_test123',
          publicMetadata: { lemonSqueezyCustomerPortalUrl: 'not-a-url' },
        },
        isSignedIn: true,
      });
      render(<PlaygroundHeader {...defaultProps} />);
      expect(screen.queryByText('Manage Subscription')).not.toBeInTheDocument();
    });

    it('displays "Manage Subscription" button with correct href if URL is valid', () => {
      const portalUrl = 'https://portal.example.com/manage';
      (useUser as jest.Mock).mockReturnValue({
        user: {
          id: 'user_test123',
          publicMetadata: { lemonSqueezyCustomerPortalUrl: portalUrl },
        },
        isSignedIn: true,
      });
      render(<PlaygroundHeader {...defaultProps} />);
      const manageButton = screen.getByText('Manage Subscription');
      expect(manageButton).toBeInTheDocument();
      expect(manageButton).toHaveAttribute('href', portalUrl);
    });
  });

  it('renders UserButton mock', () => {
    render(<PlaygroundHeader {...defaultProps} />);
    expect(screen.getByTestId('user-button-mock')).toBeInTheDocument();
  });
});
