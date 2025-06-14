import { NextApiRequest, NextApiResponse } from 'next';
import handler from '../products';
import { lemonSqueezySetup, listProducts, listVariants } from '@lemonsqueezy/lemonsqueezy.js';

jest.mock('@lemonsqueezy/lemonsqueezy.js', () => ({
  lemonSqueezySetup: jest.fn(),
  listProducts: jest.fn(),
  listVariants: jest.fn(),
}));

const mockRequest = (method: string = 'GET'): Partial<NextApiRequest> => ({
  method,
  headers: { 'content-type': 'application/json' },
});

const mockResponse = (): Partial<NextApiResponse> => {
  const res: Partial<NextApiResponse> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as NextApiResponse;
};

describe('/api/lemonsqueezy/products', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    jest.clearAllMocks();
    process.env.LEMONSQUEEZY_API_KEY = 'test-api-key';
    process.env.LEMONSQUEEZY_STORE_ID = 'test-store-id';
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('Successful Data Fetching & Variant Status Filtering', () => {
    const mockProduct1 = {
      id: 'prod_1',
      attributes: { name: 'Published Product One', description: 'Feat A\nFeat B', sort: 1, status: 'published', price_options: { currency: 'USD' } },
    };
    const mockProduct2 = { // Another published product for variety
      id: 'prod_2',
      attributes: { name: 'Published Product Two', description: 'Feat C', sort: 2, status: 'published', price_options: { currency: 'USD' } },
    };
    const mockProductDraft = { // Product that should be filtered out
      id: 'prod_draft',
      attributes: { name: 'Draft Product', description: 'Hidden', sort: 3, status: 'draft' },
    };

    // Variants for Product 1
    const mockVariantP1Active = {
      id: 'var_p1_active',
      attributes: { name: 'P1 Active Variant', price: 1000, status: 'active', is_subscription: true, interval: 'month', product_id: 'prod_1' },
    };
    const mockVariantP1Published = {
      id: 'var_p1_published',
      attributes: { name: 'P1 Published Variant', price: 2000, status: 'published', is_subscription: true, interval: 'year', product_id: 'prod_1' },
    };
    const mockVariantP1Draft = { // Should be filtered out
      id: 'var_p1_draft',
      attributes: { name: 'P1 Draft Variant', price: 500, status: 'draft', product_id: 'prod_1' },
    };
     const mockVariantP1Pending = { // Should be filtered out
      id: 'var_p1_pending',
      attributes: { name: 'P1 Pending Variant', price: 600, status: 'pending', product_id: 'prod_1' },
    };
    const mockVariantP1ContactUs = { // "Contact Us" variant, price is null
      id: 'var_p1_contact',
      attributes: { name: 'P1 Contact Us', price: null, status: 'published', product_id: 'prod_1' },
    };


    // Variants for Product 2
    const mockVariantP2Published = {
      id: 'var_p2_published',
      attributes: { name: 'P2 Published Variant', price: 3000, status: 'published', is_subscription: false, product_id: 'prod_2' },
    };


    it('should return plans from published products with active or published variants, and filter others', async () => {
      (listProducts as jest.Mock).mockResolvedValue({
        data: { data: [mockProduct1, mockProduct2, mockProductDraft] },
        error: null,
      });

      (listVariants as jest.Mock).mockImplementation(({ filter }: { filter: { product_id: string } }) => {
        if (filter.product_id === 'prod_1') {
          return Promise.resolve({ data: { data: [mockVariantP1Active, mockVariantP1Published, mockVariantP1Draft, mockVariantP1Pending, mockVariantP1ContactUs] }, error: null });
        }
        if (filter.product_id === 'prod_2') {
          return Promise.resolve({ data: { data: [mockVariantP2Published] }, error: null });
        }
        if (filter.product_id === 'prod_draft') { // Should not be called if product filtering works
          return Promise.resolve({ data: { data: [] }, error: null });
        }
        return Promise.resolve({ data: { data: [] }, error: null });
      });

      const req = mockRequest();
      const res = mockResponse();
      await handler(req as NextApiRequest, res as NextApiResponse);

      expect(res.status).toHaveBeenCalledWith(200);
      const responseData = (res.json as jest.Mock).mock.calls[0][0];

      expect(responseData).toHaveLength(4); // P1 Active, P1 Published, P1 Contact Us, P2 Published

      // Check P1 Active Variant
      const planP1Active = responseData.find((p: any) => p.id === 'var_p1_active');
      expect(planP1Active).toBeDefined();
      expect(planP1Active).toMatchObject({
        name: 'P1 Active Variant',
        productName: 'Published Product One',
        price: 1000,
        status: 'published', // Product status
        variantStatus: 'active', // Variant status
        priceFormatted: "10.00 USD/month"
      });

      // Check P1 Published Variant
      const planP1Published = responseData.find((p: any) => p.id === 'var_p1_published');
      expect(planP1Published).toBeDefined();
      expect(planP1Published).toMatchObject({
        name: 'P1 Published Variant',
        price: 2000,
        variantStatus: 'published',
        priceFormatted: "20.00 USD/year"
      });

      // Check P1 Contact Us Variant
      const planP1ContactUs = responseData.find((p: any) => p.id === 'var_p1_contact');
      expect(planP1ContactUs).toBeDefined();
      expect(planP1ContactUs).toMatchObject({
        name: 'P1 Contact Us',
        price: null, // Price is null
        variantStatus: 'published',
        priceFormatted: "Contact Us" // Correctly formatted
      });

      // Check P2 Published Variant
      const planP2Published = responseData.find((p: any) => p.id === 'var_p2_published');
      expect(planP2Published).toBeDefined();
      expect(planP2Published).toMatchObject({
        name: 'P2 Published Variant',
        productName: 'Published Product Two',
        price: 3000,
        variantStatus: 'published',
        priceFormatted: "30.00 USD" // No period as it's not a subscription
      });

      // Ensure draft/pending variants are NOT included
      expect(responseData.find((p: any) => p.id === 'var_p1_draft')).toBeUndefined();
      expect(responseData.find((p: any) => p.id === 'var_p1_pending')).toBeUndefined();

      // Ensure listVariants was not called for the draft product
      expect(listVariants).not.toHaveBeenCalledWith(expect.objectContaining({ filter: { product_id: 'prod_draft' } }));
    });
  });

  // --- Other test suites (Environment Variable Checks, SDK Errors, No Products) remain the same ---
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
      const mockProduct1 = { id: 'prod_1', attributes: { name: 'Product 1', status: 'published', sort: 1, description: 'Feat1', price_options: { currency: 'USD' } } };
      const mockProduct2 = { id: 'prod_2', attributes: { name: 'Product 2', status: 'published', sort: 2, description: 'Feat2', price_options: { currency: 'USD' } } };
      const mockVariant2 = { id: 'var_2', attributes: { name: 'Variant P2', price: 1000, status: 'active' } }; // active is allowed

      (listProducts as jest.Mock).mockResolvedValue({ data: { data: [mockProduct1, mockProduct2] }, error: null });
      (listVariants as jest.Mock)
        .mockImplementationOnce(() => Promise.resolve({ data: null, error: { message: 'Variant fetch error for prod_1' } }))
        .mockImplementationOnce(() => Promise.resolve({ data: { data: [mockVariant2] }, error: null }));

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

    it('should return 200 with an empty array if products are found but no variants are suitable', async () => {
        const mockProductWithNoValidVariants = {
            id: 'prod_novalid',
            attributes: { name: 'Product With No Valid Variants', status: 'published', sort: 1, description: '', price_options: { currency: 'USD' } },
        };
        const mockDraftVariant = {
            id: 'var_draft_only',
            attributes: { name: 'Draft Variant Only', price: 1000, status: 'draft', product_id: 'prod_novalid' },
        };
        (listProducts as jest.Mock).mockResolvedValue({ data: { data: [mockProductWithNoValidVariants] }, error: null });
        (listVariants as jest.Mock).mockResolvedValue({ data: { data: [mockDraftVariant] }, error: null });

        const req = mockRequest();
        const res = mockResponse();
        await handler(req as NextApiRequest, res as NextApiResponse);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith([]);
    });
  });
});
