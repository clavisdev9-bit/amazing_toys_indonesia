'use strict';

const { SyncStockToOdooUseCase } = require('../../domain/use_cases/SyncStockToOdooUseCase');
const { Product }                 = require('../../domain/entities/Product');
const { SYNC_STATUS }             = require('../../domain/entities/SyncStatus');

// ── Mock dependencies ─────────────────────────────────────────────────────────

const mockProductRepo = {
  findAllActive: jest.fn(),
  findById:      jest.fn(),
};

const mockOdooProductRepo = {
  ensureProductFields:  jest.fn(),
  applyStockAdjustment: jest.fn(),
  readCurrentQty:       jest.fn(),
  postNote:             jest.fn(),
};

const mockSyncRepo = {
  saveAll:              jest.fn(),
  deletePendingByBatch: jest.fn(),
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeProduct(overrides = {}) {
  return new Product({
    productId:     'P001-T001',
    productName:   'Barbie Dreamhouse',
    stockQuantity: 20,
    barcode:       '0887961896398',
    odooProductId: 42,
    ...overrides,
  });
}

const QUANT_RESULT = { quantId: 9, qtyBefore: 5, locationId: 8, variantId: 22 };

// ── Test suite ────────────────────────────────────────────────────────────────

describe('SyncStockToOdooUseCase (ETL)', () => {
  let useCase;

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new SyncStockToOdooUseCase({
      productRepo:      mockProductRepo,
      odooProductRepo:  mockOdooProductRepo,
      syncRepo:         mockSyncRepo,
    });

    // Sensible defaults
    mockSyncRepo.saveAll.mockResolvedValue(undefined);
    mockSyncRepo.deletePendingByBatch.mockResolvedValue(undefined);
    mockOdooProductRepo.ensureProductFields.mockResolvedValue(undefined);
    mockOdooProductRepo.applyStockAdjustment.mockResolvedValue(QUANT_RESULT);
    mockOdooProductRepo.readCurrentQty.mockResolvedValue(20);
    mockOdooProductRepo.postNote.mockResolvedValue(undefined);
  });

  // ── Validation ──────────────────────────────────────────────────────────────

  it('returns a failed Result when triggeredBy is empty', async () => {
    const result = await useCase.execute({ triggeredBy: '' });

    expect(result.isFailure).toBe(true);
    expect(result.error.code).toBe('VALIDATION_ERROR');
  });

  // ── STEP 1: EXTRACT ─────────────────────────────────────────────────────────

  describe('step: extract', () => {
    it('calls findAllActive when no productIds specified', async () => {
      mockProductRepo.findAllActive.mockResolvedValue([makeProduct()]);

      await useCase.execute({ triggeredBy: 'admin' });

      expect(mockProductRepo.findAllActive).toHaveBeenCalledTimes(1);
      expect(mockProductRepo.findById).not.toHaveBeenCalled();
    });

    it('calls findById for each id when productIds are provided', async () => {
      mockProductRepo.findById.mockResolvedValue(makeProduct());

      await useCase.execute({ triggeredBy: 'admin', productIds: ['P001-T001'] });

      expect(mockProductRepo.findById).toHaveBeenCalledWith('P001-T001');
      expect(mockProductRepo.findAllActive).not.toHaveBeenCalled();
    });

    it('returns a failed Result when productRepo throws', async () => {
      mockProductRepo.findAllActive.mockRejectedValue(new Error('DB connection lost'));

      const result = await useCase.execute({ triggeredBy: 'admin' });

      expect(result.isFailure).toBe(true);
      expect(result.error.message).toContain('DB connection lost');
    });

    it('extract step is logged with product count', async () => {
      mockProductRepo.findAllActive.mockResolvedValue([makeProduct(), makeProduct({ productId: 'P002-T001' })]);

      const result = await useCase.execute({ triggeredBy: 'admin' });
      const extractStep = result.value.steps.find(s => s.name === 'extract');

      expect(extractStep.status).toBe('done');
      expect(extractStep.count).toBe(2);
    });
  });

  // ── STEP 2: TRANSFORM ───────────────────────────────────────────────────────

  describe('step: transform', () => {
    it('creates one StockSyncRecord per product with PENDING status', async () => {
      mockProductRepo.findAllActive.mockResolvedValue([makeProduct()]);

      const result = await useCase.execute({ triggeredBy: 'admin' });
      const transformStep = result.value.steps.find(s => s.name === 'transform');

      expect(transformStep.status).toBe('done');
      expect(transformStep.count).toBe(1);
    });

    it('maps qtySent from product.stockQuantity', async () => {
      mockProductRepo.findAllActive.mockResolvedValue([makeProduct({ stockQuantity: 20 })]);

      const result = await useCase.execute({ triggeredBy: 'admin' });

      expect(result.value.records[0].qtySent).toBe(20);
    });

    it('preserves odooProductId as null for unmapped products', async () => {
      mockProductRepo.findAllActive.mockResolvedValue([makeProduct({ odooProductId: null })]);

      const result = await useCase.execute({ triggeredBy: 'admin' });

      expect(result.value.records[0].odooProductId).toBeNull();
    });
  });

  // ── STEP 3: TRUNCATE ────────────────────────────────────────────────────────

  describe('step: truncate', () => {
    it('calls deletePendingByBatch with the batch UUID', async () => {
      mockProductRepo.findAllActive.mockResolvedValue([makeProduct()]);

      const result = await useCase.execute({ triggeredBy: 'admin' });

      expect(mockSyncRepo.deletePendingByBatch).toHaveBeenCalledWith(result.value.batchId);
    });

    it('returns a failed Result when truncate throws', async () => {
      mockProductRepo.findAllActive.mockResolvedValue([makeProduct()]);
      mockSyncRepo.deletePendingByBatch.mockRejectedValue(new Error('DB locked'));

      const result = await useCase.execute({ triggeredBy: 'admin' });

      expect(result.isFailure).toBe(true);
    });
  });

  // ── STEP 4: INSERT ──────────────────────────────────────────────────────────

  describe('step: insert', () => {
    it('calls ensureProductFields with the odoo template id', async () => {
      mockProductRepo.findAllActive.mockResolvedValue([makeProduct()]);

      await useCase.execute({ triggeredBy: 'admin' });

      expect(mockOdooProductRepo.ensureProductFields).toHaveBeenCalledWith(42);
    });

    it('calls applyStockAdjustment with templateId and qtySent', async () => {
      mockProductRepo.findAllActive.mockResolvedValue([makeProduct({ stockQuantity: 20 })]);

      await useCase.execute({ triggeredBy: 'admin' });

      expect(mockOdooProductRepo.applyStockAdjustment).toHaveBeenCalledWith(42, 20);
    });

    it('captures qtyConfirmed from readCurrentQty', async () => {
      mockProductRepo.findAllActive.mockResolvedValue([makeProduct()]);
      mockOdooProductRepo.readCurrentQty.mockResolvedValue(20);

      const result = await useCase.execute({ triggeredBy: 'admin' });

      expect(result.value.records[0].qtyConfirmed).toBe(20);
    });

    it('calls postNote with qtyBefore, qtyConfirmed, and triggeredBy', async () => {
      mockProductRepo.findAllActive.mockResolvedValue([makeProduct()]);

      await useCase.execute({ triggeredBy: 'user-abc' });

      expect(mockOdooProductRepo.postNote).toHaveBeenCalledWith(
        42,
        expect.objectContaining({ qtyBefore: 5, qtyConfirmed: 20, triggeredBy: 'user-abc' })
      );
    });

    it('marks record SKIPPED (UNMAPPED) when odooProductId is null — skips all Odoo calls', async () => {
      mockProductRepo.findAllActive.mockResolvedValue([makeProduct({ odooProductId: null })]);

      const result = await useCase.execute({ triggeredBy: 'admin' });

      expect(result.value.records[0].status).toBe(SYNC_STATUS.SKIPPED);
      expect(result.value.records[0].eligibilityRule).toBe('unmapped');
      expect(mockOdooProductRepo.ensureProductFields).not.toHaveBeenCalled();
    });

    it('marks record FAILED when ensureProductFields throws — does not abort batch', async () => {
      const p1 = makeProduct({ productId: 'P001', odooProductId: 1 });
      const p2 = makeProduct({ productId: 'P002', odooProductId: 2, stockQuantity: 8 });
      mockProductRepo.findAllActive.mockResolvedValue([p1, p2]);
      mockOdooProductRepo.ensureProductFields
        .mockRejectedValueOnce(new Error('Odoo RPC timeout'))
        .mockResolvedValueOnce(undefined);
      mockOdooProductRepo.applyStockAdjustment
        .mockResolvedValueOnce({ quantId: 9, qtyBefore: 3, locationId: 8, variantId: 22 });
      mockOdooProductRepo.readCurrentQty.mockResolvedValue(8);

      const result = await useCase.execute({ triggeredBy: 'admin' });

      expect(result.value.failed).toBe(1);
      expect(result.value.success).toBe(1);
      expect(result.value.records[0].status).toBe(SYNC_STATUS.FAILED);
      expect(result.value.records[1].status).toBe(SYNC_STATUS.SUCCESS);
    });

    it('marks record FAILED when applyStockAdjustment throws', async () => {
      mockProductRepo.findAllActive.mockResolvedValue([makeProduct()]);
      mockOdooProductRepo.applyStockAdjustment.mockRejectedValue(new Error('Quant not found'));

      const result = await useCase.execute({ triggeredBy: 'admin' });

      expect(result.value.records[0].status).toBe(SYNC_STATUS.FAILED);
      expect(result.value.records[0].errorMessage).toBe('Quant not found');
    });

    it('insert step count reflects only SUCCESS records', async () => {
      mockProductRepo.findAllActive.mockResolvedValue([makeProduct()]);
      mockOdooProductRepo.applyStockAdjustment.mockResolvedValue(QUANT_RESULT);

      const result = await useCase.execute({ triggeredBy: 'admin' });
      const insertStep = result.value.steps.find(s => s.name === 'insert');

      expect(insertStep.count).toBe(1);
    });
  });

  // ── STEP 5: VALIDATE ────────────────────────────────────────────────────────

  describe('step: validate', () => {
    it('validate step is done when all records have terminal status', async () => {
      mockProductRepo.findAllActive.mockResolvedValue([makeProduct()]);

      const result = await useCase.execute({ triggeredBy: 'admin' });
      const validateStep = result.value.steps.find(s => s.name === 'validate');

      expect(validateStep.status).toBe('done');
      expect(validateStep.count).toBe(1);
    });

    it('batch still succeeds even when one product fails (validate is non-fatal)', async () => {
      mockProductRepo.findAllActive.mockResolvedValue([makeProduct()]);
      mockOdooProductRepo.applyStockAdjustment.mockRejectedValue(new Error('timeout'));

      const result = await useCase.execute({ triggeredBy: 'admin' });

      expect(result.isSuccess).toBe(true);
      expect(result.value.failed).toBe(1);
    });
  });

  // ── STEP 6: PERSIST ─────────────────────────────────────────────────────────

  describe('step: persist', () => {
    it('calls saveAll with all processed records (single atomic call)', async () => {
      mockProductRepo.findAllActive.mockResolvedValue([makeProduct()]);

      const result = await useCase.execute({ triggeredBy: 'admin' });

      expect(mockSyncRepo.saveAll).toHaveBeenCalledTimes(1);
      expect(mockSyncRepo.saveAll).toHaveBeenCalledWith(result.value.records);
    });

    it('returns a failed Result when saveAll throws', async () => {
      mockProductRepo.findAllActive.mockResolvedValue([makeProduct()]);
      mockSyncRepo.saveAll.mockRejectedValue(new Error('Transaction rolled back'));

      const result = await useCase.execute({ triggeredBy: 'admin' });

      expect(result.isFailure).toBe(true);
      expect(result.error.message).toContain('Transaction rolled back');
    });

    it('persist step is logged with total record count', async () => {
      mockProductRepo.findAllActive.mockResolvedValue([makeProduct(), makeProduct({ productId: 'P002-T001', odooProductId: null })]);

      const result = await useCase.execute({ triggeredBy: 'admin' });
      const persistStep = result.value.steps.find(s => s.name === 'persist');

      expect(persistStep.status).toBe('done');
      expect(persistStep.count).toBe(2);
    });
  });

  // ── Full success path ────────────────────────────────────────────────────────

  it('full batch: 1 synced, returns correct SyncBatch summary', async () => {
    mockProductRepo.findAllActive.mockResolvedValue([makeProduct()]);

    const result = await useCase.execute({ triggeredBy: 'user-abc' });

    expect(result.isSuccess).toBe(true);
    const batch = result.value;
    expect(batch.total).toBe(1);
    expect(batch.success).toBe(1);
    expect(batch.failed).toBe(0);
    expect(batch.skipped).toBe(0);
    expect(batch.steps).toHaveLength(6);
    expect(batch.steps.map(s => s.name)).toEqual([
      'extract', 'transform', 'truncate', 'insert', 'validate', 'persist',
    ]);
    expect(batch.records[0].status).toBe(SYNC_STATUS.SUCCESS);
    expect(batch.records[0].qtyBefore).toBe(5);
    expect(batch.records[0].qtySent).toBe(20);
    expect(batch.records[0].qtyConfirmed).toBe(20);
  });
});
