import { NextApiRequest, NextApiResponse } from 'next';
import handler from '../products'; // Adjust path as necessary
import { lemonSqueezySetup, listProducts, listVariants } from '@lemonsqueezy/lemonsqueezy.js';

// Mock the @lemonsqueezy/lemonsqueezy.js SDK
jest.mock('@lemonsqueezy/lemonsqueezy.js', () => ({
  lemonSqueezySetup: jest.fn(),
  listProducts: jest.fn(),
  listVariants: jest.fn(),
}));

// Helper to create a mock API request
const mockRequest = (method: string = 'GET'): Partial<NextApiRequest> => ({
  method,
  headers: { 'content-type': 'application/json' },
});

// Helper to create a mock API response
const mockResponse = (): Partial<NextApiResponse> => {
  const res: Partial<NextApiResponse> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as NextApiResponse;
};

describe('/api/lemonsqueezy/products', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules(); // Clear cache for process.env changes
    process.env = { ...originalEnv }; // Restore original env
    jest.clearAllMocks();
    process.env.LEMONSQUEEZY_API_KEY = 'test-api-key';
    process.env.LEMONSQUEEZY_STORE_ID = 'test-store-id';
  });

  afterAll(() => {
    process.env = originalEnv; // Restore original env after all tests
  });

  describe('Successful Data Fetching', () => {
    const mockProduct1 = {
      id: 'prod_1',
      attributes: { name: 'Pro Product', description: 'Feature A\nFeature B', sort: 1, status: 'published', price_options: { currency: 'USD' } },
    };
    const mockProduct2 = {
      id: 'prod_2',
      attributes: { name: 'Basic Product', description: 'Feature C', sort: 2, status: 'published', price_options: { currency: 'USD' } },
    };
    const mockProductDraft = {
      id: 'prod_draft',
      attributes: { name: 'Draft Product', description: 'Hidden Feature', sort: 3, status: 'draft' },
    };

    const mockVariant1Pro = {
      id: 'var_1_pro',
      attributes: { name: 'Pro Monthly', price: 2500, status: 'active', is_subscription: true, interval: 'month', product_id: 'prod_1' },
    };
    const mockVariant2ProInactive = {
      id: 'var_2_pro_inactive',
      attributes: { name: 'Pro Yearly Inactive', price: 25000, status: 'inactive', product_id: 'prod_1' },
    };
    const mockVariant1Basic = {
      id: 'var_1_basic',
      attributes: { name: 'Basic Monthly', price: 1000, status: 'active', is_subscription: true, interval: 'month', product_id: 'prod_2' },
    };

    it('should return transformed plan data correctly', async () => {
      (listProducts as jest.Mock).mockResolvedValue({
        data: { data: [mockProduct1, mockProduct2, mockProductDraft] },
        error: null,
      });
      (listVariants as jest.Mock)
        .mockImplementation(({ filter }: { filter: { product_id: string }}) => {
            if (filter.product_id === 'prod_1') {
                return Promise.resolve({ data: { data: [mockVariant1Pro, mockVariant2ProInactive] }, error: null });
            }
            if (filter.product_id === 'prod_2') {
                return Promise.resolve({ data: { data: [mockVariant1Basic] }, error: null });
            }
            return Promise.resolve({ data: { data: [] }, error: null });
        });

      const req = mockRequest();
      const res = mockResponse();
      await handler(req as NextApiRequest, res as NextApiResponse);

      expect(res.status).toHaveBeenCalledWith(200);
      const responseData = (res.json as jest.Mock).mock.calls[0][0];
      expect(responseData).toHaveLength(2); // Pro Monthly and Basic Monthly (Draft product and inactive variant filtered out)

      // Check Pro Plan (Product 1, Variant 1)
      expect(responseData[0]).toMatchObject({
        id: 'var_1_pro',
        name: 'Pro Monthly',
        productName: 'Pro Product',
        price: 2500,
        currency: 'USD',
        period: 'month',
        features: ['Feature A', 'Feature B'],
        sort: 1,
        status: 'published',
        variantStatus: 'active',
        variantIdForCheckout: 'var_1_pro',
        priceFormatted: "25.00 USD/month"
      });

      // Check Basic Plan (Product 2, Variant 1)
      expect(responseData[1]).toMatchObject({
        id: 'var_1_basic',
        name: 'Basic Monthly',
        productName: 'Basic Product',
        price: 1000,
        currency: 'USD',
        period: 'month',
        features: ['Feature C'],
        sort: 2,
        status: 'published',
        variantStatus: 'active',
        variantIdForCheckout: 'var_1_basic',
        priceFormatted: "10.00 USD/month"
      });
      expect(lemonSqueezySetup).toHaveBeenCalledWith({ apiKey: 'test-api-key', onError: expect.any(Function) });
    });
  });

  describe('Environment Variable Checks', () => {
    it('should return 500 if LEMONSQUEEZY_API_KEY is not set', async () => {
      delete process.env.LEMONSQUEEZY_API_KEY;
      const req = mockRequest();
      const res = mockResponse();
      await handler(req as NextApiRequest, res as NextApiResponse);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Server configuration error: Missing API key.' });
    });

    it('should return 500 if LEMONSQUEEZY_STORE_ID is not set', async () => {
      delete process.env.LEMONSQUEEZY_STORE_ID;
      const req = mockRequest();
      const res = mockResponse();
      await handler(req as NextApiRequest, res as NextApiResponse);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Server configuration error: Missing Store ID.' });
    });
  });

  describe('Lemon Squeezy SDK Errors', () => {
    it('should return 500 if listProducts fails', async () => {
      (listProducts as jest.Mock).mockResolvedValue({
        data: null,
        error: { message: 'SDK product fetch error', statusCode: 500, originalError: new Error('Original') },
      });
      const req = mockRequest();
      const res = mockResponse();
      await handler(req as NextApiRequest, res as NextApiResponse);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Failed to fetch products.', details: 'SDK product fetch error' });
    });

    it('should continue processing other products if listVariants fails for one product', async () => {
      const mockProduct1 = { id: 'prod_1', attributes: { name: 'Product 1', status: 'published', sort: 1, description: 'Feat1' } };
      const mockProduct2 = { id: 'prod_2', attributes: { name: 'Product 2', status: 'published', sort: 2, description: 'Feat2' } };
      const mockVariant2 = { id: 'var_2', attributes: { name: 'Variant P2', price: 1000, status: 'active' } };

      (listProducts as jest.Mock).mockResolvedValue({ data: { data: [mockProduct1, mockProduct2] }, error: null });
      (listVariants as jest.Mock)
        .mockImplementationOnce(() => Promise.resolve({ data: null, error: { message: 'Variant fetch error for prod_1' } })) // Fails for prod_1
        .mockImplementationOnce(() => Promise.resolve({ data: { data: [mockVariant2] }, error: null })); // Succeeds for prod_2

      const req = mockRequest();
      const res = mockResponse();
      await handler(req as NextApiRequest, res as NextApiResponse);

      expect(res.status).toHaveBeenCalledWith(200);
      const responseData = (res.json as jest.Mock).mock.calls[0][0];
      expect(responseData).toHaveLength(1);
      expect(responseData[0].productName).toBe('Product 2');
    });
  });

  describe('No Products Found', () => {
    it('should return 200 with an empty array if no products are found', async () => {
      (listProducts as jest.Mock).mockResolvedValue({ data: { data: [] }, error: null });
      const req = mockRequest();
      const res = mockResponse();
      await handler(req as NextApiRequest, res as NextApiResponse);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith([]);
    });
  });
});
