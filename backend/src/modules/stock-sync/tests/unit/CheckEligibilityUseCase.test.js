'use strict';

const { CheckEligibilityUseCase } = require('../../domain/use_cases/CheckEligibilityUseCase');
const { Product }                  = require('../../domain/entities/Product');
const { ELIGIBILITY }              = require('../../domain/entities/EligibilityResult');

function makeAdapter(overrides = {}) {
  return { readEligibilityFields: jest.fn(), ...overrides };
}

function makeProduct(overrides = {}) {
  return new Product({
    productId: 'P001', productName: 'Test', stockQuantity: 5,
    barcode: null, odooProductId: 10, ...overrides,
  });
}

describe('CheckEligibilityUseCase', () => {
  it('returns UNMAPPED when product has no odooProductId', async () => {
    const adapter = makeAdapter();
    const uc      = new CheckEligibilityUseCase(adapter);
    const result  = await uc.execute(makeProduct({ odooProductId: null }));

    expect(result.eligible).toBe(false);
    expect(result.rule).toBe(ELIGIBILITY.UNMAPPED);
    expect(adapter.readEligibilityFields).not.toHaveBeenCalled();
  });

  it('returns PASS when all three rules satisfied', async () => {
    const adapter = makeAdapter();
    adapter.readEligibilityFields.mockResolvedValue({
      type: 'consu', invoice_policy: 'order', is_storable: true,
    });
    const result = await new CheckEligibilityUseCase(adapter).execute(makeProduct());
    expect(result.eligible).toBe(true);
    expect(result.rule).toBe(ELIGIBILITY.PASS);
  });

  it('returns FAIL_TYPE when type is service', async () => {
    const adapter = makeAdapter();
    adapter.readEligibilityFields.mockResolvedValue({
      type: 'service', invoice_policy: 'order', is_storable: false,
    });
    const result = await new CheckEligibilityUseCase(adapter).execute(makeProduct());
    expect(result.eligible).toBe(false);
    expect(result.rule).toBe(ELIGIBILITY.FAIL_TYPE);
  });

  it('returns FAIL_POLICY when invoice_policy is delivery', async () => {
    const adapter = makeAdapter();
    adapter.readEligibilityFields.mockResolvedValue({
      type: 'consu', invoice_policy: 'delivery', is_storable: true,
    });
    const result = await new CheckEligibilityUseCase(adapter).execute(makeProduct());
    expect(result.eligible).toBe(false);
    expect(result.rule).toBe(ELIGIBILITY.FAIL_POLICY);
  });

  it('returns FAIL_STORABLE when is_storable is false', async () => {
    const adapter = makeAdapter();
    adapter.readEligibilityFields.mockResolvedValue({
      type: 'consu', invoice_policy: 'order', is_storable: false,
    });
    const result = await new CheckEligibilityUseCase(adapter).execute(makeProduct());
    expect(result.eligible).toBe(false);
    expect(result.rule).toBe(ELIGIBILITY.FAIL_STORABLE);
  });
});
