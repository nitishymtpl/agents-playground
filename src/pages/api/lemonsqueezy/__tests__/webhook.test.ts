import { NextApiRequest, NextApiResponse } from 'next';
import handler from '../webhook'; // Adjust path as necessary
import crypto from 'crypto';
import { clerkClient } from '@clerk/nextjs/server';

// Mock Clerk client
jest.mock('@clerk/nextjs/server', () => ({
  clerkClient: {
    users: {
      getUser: jest.fn(),
      updateUserMetadata: jest.fn(),
    },
  },
}));

// Mock crypto for signature verification
const mockUpdate = jest.fn().mockReturnThis();
const mockDigest = jest.fn();
jest.mock('crypto', () => ({
  ...jest.requireActual('crypto'), // Import and retain default behavior
  createHmac: jest.fn(() => ({
    update: mockUpdate,
    digest: mockDigest,
  })),
  timingSafeEqual: jest.fn(),
}));

// Helper to create a mock API request
const mockRequest = (body: any, signature?: string, method: string = 'POST'): Partial<NextApiRequest> => {
  const req: Partial<NextApiRequest> & { _rawBody?: Buffer } = {
    method,
    headers: {
      'x-signature': signature,
      'content-type': 'application/json',
    },
    body, // For when bodyParser is not false (though our handler disables it)
    _rawBody: Buffer.from(JSON.stringify(body)), // Simulate rawBody for our getRawBody helper
    on: jest.fn((event, callback) => { // Mock .on() for getRawBody
        if (event === 'data') {
            callback(Buffer.from(JSON.stringify(body)));
        }
        if (event === 'end') {
            callback();
        }
    }) as any,
  };
  return req as NextApiRequest;
};

// Helper to create a mock API response
const mockResponse = (): Partial<NextApiResponse> => {
  const res: Partial<NextApiResponse> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn().mockReturnValue(res);
  res.end = jest.fn().mockReturnValue(res);
  return res as NextApiResponse;
};

const webhookSecret = 'test-secret';
process.env.LEMONSQUEEZY_WEBHOOK_SECRET = webhookSecret;
process.env.CLERK_SECRET_KEY = 'test-clerk-secret'; // Needs to be set for the module execution

// Define planCredits as it's used in the webhook handler
const planCreditsConfig = {
  'plan_basic': 100,
  'plan_pro': 500,
  'variant_123': 100, // Example using variant ID
};


describe('/api/lemonsqueezy/webhook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset getUser mock for each test if needed
    (clerkClient.users.getUser as jest.Mock).mockResolvedValue({
        publicMetadata: {}, // Default mock for existing metadata
    });
  });

  const generateSignature = (body: string) => {
    return crypto.createHmac('sha256', webhookSecret).update(body).digest('hex');
  };

  it('should return 405 if method is not POST', async () => {
    const req = mockRequest({}, undefined, 'GET');
    const res = mockResponse();
    await handler(req as NextApiRequest, res as NextApiResponse);
    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.end).toHaveBeenCalledWith('Method GET Not Allowed');
  });

  it('should return 400 if signature is missing when secret is set', async () => {
    const req = mockRequest({ meta: { event_name: 'test' } });
    // @ts-ignore
    delete req.headers['x-signature']; // Remove signature
    const res = mockResponse();
    await handler(req as NextApiRequest, res as NextApiResponse);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith('Signature missing');
  });

  it('should return 400 if signature is invalid', async () => {
    const body = { meta: { event_name: 'test' } };
    const req = mockRequest(body, 'invalid-signature');
    (crypto.timingSafeEqual as jest.Mock).mockReturnValue(false);
    mockDigest.mockReturnValue('correct-signature-hash'); // What createHmac().digest() would return

    const res = mockResponse();
    await handler(req as NextApiRequest, res as NextApiResponse);

    expect(crypto.createHmac).toHaveBeenCalledWith('sha256', webhookSecret);
    expect(mockUpdate).toHaveBeenCalledWith(Buffer.from(JSON.stringify(body)));
    expect(mockDigest).toHaveBeenCalledWith('hex');
    expect(crypto.timingSafeEqual).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith('Invalid signature');
  });

  describe('Event: subscription_created', () => {
    const eventName = 'subscription_created';
    const mockUserId = 'user_123clerk';
    const mockVariantId = 'variant_123'; // Matches a key in planCreditsConfig

    const mockPayload = {
      meta: {
        event_name: eventName,
        custom_data: { clerk_user_id: mockUserId },
      },
      data: {
        id: 'sub_test123',
        attributes: {
          status: 'active',
          variant_id: mockVariantId,
          product_id: 'prod_abc',
          plan_id: 'deprecated_plan_id_field', // ensure variant_id is preferred
          ends_at: null,
          urls: { customer_portal: 'http://portal.example.com' },
          test_mode: false,
        },
      },
    };

    it('should update user metadata with subscription details and credits', async () => {
      const signature = generateSignature(JSON.stringify(mockPayload));
      const req = mockRequest(mockPayload, signature);
      const res = mockResponse();
      (crypto.timingSafeEqual as jest.Mock).mockReturnValue(true); // Simulate valid signature
      (clerkClient.users.getUser as jest.Mock).mockResolvedValue({ publicMetadata: {} });


      await handler(req as NextApiRequest, res as NextApiResponse);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(clerkClient.users.updateUserMetadata).toHaveBeenCalledWith(mockUserId, {
        publicMetadata: {
          lemonSqueezySubscriptionId: 'sub_test123',
          lemonSqueezyPlanId: mockVariantId,
          lemonSqueezyStatus: 'active',
          lemonSqueezyVariantId: mockVariantId,
          lemonSqueezyProductId: 'prod_abc',
          lemonSqueezyEndsAt: null,
          lemonSqueezyCustomerPortalUrl: 'http://portal.example.com',
          lemonSqueezyTestMode: false,
          planCreditAmount: planCreditsConfig[mockVariantId],
          creditsAvailable: planCreditsConfig[mockVariantId],
        },
      });
    });

    it('should merge with existing publicMetadata', async () => {
        const signature = generateSignature(JSON.stringify(mockPayload));
        const req = mockRequest(mockPayload, signature);
        const res = mockResponse();
        (crypto.timingSafeEqual as jest.Mock).mockReturnValue(true);
        (clerkClient.users.getUser as jest.Mock).mockResolvedValue({
            publicMetadata: { existing_key: 'existing_value' }
        });

        await handler(req as NextApiRequest, res as NextApiResponse);

        expect(clerkClient.users.updateUserMetadata).toHaveBeenCalledWith(mockUserId, {
          publicMetadata: expect.objectContaining({
            existing_key: 'existing_value', // Ensure existing data is preserved
            lemonSqueezyPlanId: mockVariantId, // Ensure new data is added
            creditsAvailable: planCreditsConfig[mockVariantId],
          }),
        });
      });

    it('should warn if clerk_user_id is missing and return 400', async () => {
        const payloadWithoutUserId = { ...mockPayload, meta: { ...mockPayload.meta, custom_data: {} } };
        const signature = generateSignature(JSON.stringify(payloadWithoutUserId));
        const req = mockRequest(payloadWithoutUserId, signature);
        const res = mockResponse();
        (crypto.timingSafeEqual as jest.Mock).mockReturnValue(true);
        console.warn = jest.fn(); // Spy on console.warn

        await handler(req as NextApiRequest, res as NextApiResponse);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.send).toHaveBeenCalledWith('Clerk User ID (clerk_user_id) missing in webhook payload for subscription_created.');
        expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('clerk_user_id missing in webhook payload for subscription_created'));
        expect(clerkClient.users.updateUserMetadata).not.toHaveBeenCalled();
    });
  });

  describe('Event: subscription_cancelled / subscription_expired', () => {
    const mockUserId = 'user_cancel123';
    const mockVariantId = 'variant_123';
    const mockSubscriptionId = 'sub_cancelled_test';

    ['subscription_cancelled', 'subscription_expired'].forEach(eventName => {
      it(`should handle ${eventName} and reset credits`, async () => {
        const mockPayload = {
          meta: {
            event_name: eventName,
            custom_data: { clerk_user_id: mockUserId },
          },
          data: {
            id: mockSubscriptionId,
            attributes: {
              status: eventName === 'subscription_cancelled' ? 'cancelled' : 'expired',
              variant_id: mockVariantId,
              product_id: 'prod_abc',
              ends_at: '2024-12-31T23:59:59Z',
              urls: { customer_portal: 'http://portal.example.com' },
              test_mode: false,
            },
          },
        };
        const signature = generateSignature(JSON.stringify(mockPayload));
        const req = mockRequest(mockPayload, signature);
        const res = mockResponse();
        (crypto.timingSafeEqual as jest.Mock).mockReturnValue(true);
        (clerkClient.users.getUser as jest.Mock).mockResolvedValue({ publicMetadata: { creditsAvailable: 50 } });


        await handler(req as NextApiRequest, res as NextApiResponse);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(clerkClient.users.updateUserMetadata).toHaveBeenCalledWith(mockUserId, {
          publicMetadata: {
            lemonSqueezySubscriptionId: mockSubscriptionId,
            lemonSqueezyPlanId: mockVariantId,
            lemonSqueezyStatus: eventName === 'subscription_cancelled' ? 'cancelled' : 'expired',
            lemonSqueezyVariantId: mockVariantId,
            lemonSqueezyProductId: 'prod_abc',
            lemonSqueezyEndsAt: '2024-12-31T23:59:59Z',
            lemonSqueezyCustomerPortalUrl: 'http://portal.example.com',
            lemonSqueezyTestMode: false,
            planCreditAmount: 0,
            creditsAvailable: 0,
          },
        });
      });
    });
  });

  // TODO: Add tests for subscription_updated (similar to created, might affect credits differently based on rules)
  // TODO: Add tests for unhandled event types
  // TODO: Test case where planId from webhook is not in planCreditsConfig map
});
