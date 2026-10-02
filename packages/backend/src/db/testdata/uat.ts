/**
 * The manual-testing dataset ("UAT"): two farms with a closed batch, a batch ready to sell and a young
 * batch; stock, mill, sales, payroll and money each left with records in every state a tester needs.
 * Everything is dated relative to the day it is built. See docs/testing/README.md.
 */
import { and, asc, eq } from 'drizzle-orm';
import type { Api } from './harness';
import { day, month, seededRandom, TODAY, weekday } from './harness';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- API responses are read loosely here
type Row = Record<string, any>;
export type Persona = { key: string; firstName: string; lastName: string; role: string; farm: 'main' | 'expansion' | null };

export const PERSONAS: Persona[] = [
  { key: 'nimal.manager', firstName: 'Nimal', lastName: 'Perera', role: 'farm_manager', farm: 'main' },
  { key: 'dilani.manager', firstName: 'Dilani', lastName: 'Jayawardena', role: 'farm_manager', farm: 'expansion' },
  { key: 'kamal.supervisor', firstName: 'Kamal', lastName: 'Silva', role: 'supervisor', farm: 'expansion' },
  { key: 'ruwan.accounts', firstName: 'Ruwan', lastName: 'Fernando', role: 'accountant', farm: null },
  { key: 'saman.mill', firstName: 'Saman', lastName: 'Wijesinghe', role: 'feed_mill_operator', farm: null },
  { key: 'sunil.worker', firstName: 'Sunil', lastName: 'Bandara', role: 'farm_worker', farm: 'main' },
  { key: 'vinod.viewer', firstName: 'Vinod', lastName: 'Rathnayake', role: 'viewer', farm: null },
];
export const personaUid = (key: string) => `uat:${key}`;
export const personaEmail = (key: string) => `${key}@farmflow.test`;

/** Target cumulative feed per bird (g) by day of age, from the example growth curve. */
const FEED_CURVE: Array<[number, number]> = [[0, 0], [7, 160], [14, 580], [21, 1300], [28, 2350], [35, 3650], [42, 5100]];
const WEIGHT_CURVE: Array<[number, number]> = [[0, 42], [7, 190], [14, 480], [21, 950], [28, 1550], [35, 2200], [42, 2850]];
function curve(points: Array<[number, number]>, age: number) {
  for (let i = 1; i < points.length; i += 1) {
    const [d0, v0] = points[i - 1];
    const [d1, v1] = points[i];
    if (age <= d1) return v0 + ((v1 - v0) * (age - d0)) / (d1 - d0);
  }
  return points[points.length - 1][1];
}

export async function buildUatDataset(ctx: { as: (uid: string) => Api; adminUid: string; log: (line: string) => void }) {
  const { db } = await import('../index');
  const schema = await import('../schema');
  const { receivePurchaseOrder } = await import('../../lib/procurement');
  const { log } = ctx;
  const admin = ctx.as(ctx.adminUid);

  const M0 = month(0);
  const M1 = month(1);
  const M2 = month(2);
  const M3 = month(3);

  // ─── Lookups ────────────────────────────────────────────────────────────────
  const categoryId = async (code: string) => {
    const [row] = await db.select().from(schema.financeCategories).where(eq(schema.financeCategories.code, code)).limit(1);
    if (!row) throw new Error(`No finance category ${code}`);
    return row.id;
  };
  const userId = async (uid: string) => {
    const [row] = await db.select().from(schema.users).where(eq(schema.users.firebaseUid, uid)).limit(1);
    if (!row) throw new Error(`No user ${uid}`);
    return row.id;
  };
  const adminUserId = await userId(ctx.adminUid);

  // ─── 1. Farms, houses, people who sign in ───────────────────────────────────
  log('Farms and houses');
  const mainFarm = await admin<Row>('POST', '/sites', { siteName: 'Main Farm', location: 'Kurunegala', capacity: 15000 });
  const expansion = await admin<Row>('POST', '/sites', { siteName: 'Expansion 1', location: 'Wariyapola', capacity: 10000 });
  const house: Record<string, Row> = {};
  for (const [site, names] of [[mainFarm, ['House 1', 'House 2', 'House 3']], [expansion, ['House A', 'House B']]] as Array<[Row, string[]]>) {
    for (const name of names) {
      house[name] = await admin<Row>('POST', `/sites/${site.id}/cages`, { siteId: site.id, cageNumber: name, capacity: 5000 });
    }
  }
  const siteOf = { main: mainFarm.id as number, expansion: expansion.id as number };

  for (const persona of PERSONAS) {
    await db.insert(schema.users).values({
      firebaseUid: personaUid(persona.key),
      email: personaEmail(persona.key),
      firstName: persona.firstName,
      lastName: persona.lastName,
      fullName: `${persona.firstName} ${persona.lastName}`,
      userRole: persona.role,
      siteId: persona.farm ? siteOf[persona.farm] : null,
      isActive: true,
    });
  }
  const nimal = ctx.as(personaUid('nimal.manager'));
  const dilani = ctx.as(personaUid('dilani.manager'));
  const kamal = ctx.as(personaUid('kamal.supervisor'));
  const saman = ctx.as(personaUid('saman.mill'));
  const nimalUserId = await userId(personaUid('nimal.manager'));

  const costCentres = await db.select().from(schema.costCentres);
  const cc = {
    main: costCentres.find((c) => c.siteId === siteOf.main)!.id,
    expansion: costCentres.find((c) => c.siteId === siteOf.expansion)!.id,
    mill: costCentres.find((c) => c.code === 'MILL')!.id,
    admin: costCentres.find((c) => c.code === 'ADMIN')!.id,
  };
  const locations = await db.select().from(schema.stockLocations);
  const store = {
    main: locations.find((l) => l.code === 'MAIN')!.id,
    mill: locations.find((l) => l.code === 'MILL')!.id,
    mainFarm: locations.find((l) => l.siteId === siteOf.main)!.id,
    expansion: locations.find((l) => l.siteId === siteOf.expansion)!.id,
  };

  // ─── 2. Money accounts, limits ──────────────────────────────────────────────
  log('Money accounts');
  const current = await admin<Row>('POST', '/treasury/accounts', {
    accountCode: 'TR-CUR-001', accountName: 'Main Current Account', accountType: 'current', bankName: 'Commercial Bank',
    branchName: 'Kurunegala', accountNumberMasked: '****4821', allowsCheque: true, openingBalance: 1_500_000, openingBalanceDate: M3.start,
  });
  const safe = await admin<Row>('POST', '/treasury/accounts', {
    accountCode: 'TR-CASH-001', accountName: 'Main Cash Safe', accountType: 'cash', openingBalance: 200_000, openingBalanceDate: M3.start,
  });
  const petty = await admin<Row>('POST', '/treasury/accounts', {
    accountCode: 'TR-PC-001', accountName: 'Farm Petty Cash Float', accountType: 'petty_cash', openingBalance: 0, openingBalanceDate: M3.start,
  });
  await admin('POST', '/treasury/cheque-books', { financeAccountId: current.id, bookCode: 'CB-0001', startNumber: 100101, endNumber: 100125, issuedDate: M3.start });
  const leaves = await db.select().from(schema.chequeLeaves).orderBy(asc(schema.chequeLeaves.id));

  /** Money out by hand (no other document behind it). */
  const pay = async (body: { date: string; amount: number; category: string; costCentreId: number; batchId?: number; narrative: string; counterparty?: string; account?: number; reference?: string }) => admin<Row>('POST', '/treasury/transactions/manual', {
    transactionDate: body.date,
    transactionType: 'manual_outflow',
    financeAccountId: body.account ?? current.id,
    amount: body.amount,
    narrative: body.narrative,
    counterpartyName: body.counterparty ?? '',
    referenceNumber: body.reference ?? '',
    categoryId: await categoryId(body.category),
    costCentreId: body.costCentreId,
    ...(body.batchId ? { batchId: body.batchId } : {}),
  });

  log('Owner money, loan, opening transfers');
  await admin('POST', '/finance/owner-money', { direction: 'in', amount: 4_000_000, date: day(-75), financeAccountId: current.id, reference: 'CAP-001', notes: 'Owner capital to start the season' });
  await admin('POST', '/treasury/transactions/manual', {
    transactionDate: day(-74), transactionType: 'internal_transfer', sourceFinanceAccountId: current.id, destinationFinanceAccountId: safe.id,
    amount: 300_000, narrative: 'Cash drawn for the safe', referenceNumber: 'TRF-001',
  });
  const bankLoan = await admin<Row>('POST', '/finance/loans', {
    lender: 'Commercial Bank', principal: 3_000_000, receivedDate: day(-72), financeAccountId: current.id,
    interestRate: 12, termMonths: 24, monthlyInstallment: 155_000, notes: 'Working capital loan',
  });

  // ─── 3. Suppliers, stock items, recipes ─────────────────────────────────────
  log('Suppliers, stock items, recipes');
  const supplier: Record<string, Row> = {};
  for (const [key, name, contact, category] of [
    ['agri', 'Agri Feeds', 'Mahesh Gunawardena', 'feed_raw_materials'],
    ['acme', 'Acme Suppliers', 'Shirani Peiris', 'medicine_vaccines'],
    ['hatchery', 'Lanka Hatcheries', 'Roshan de Mel', 'chicks'],
    ['power', 'Ceylon Power Services', 'Anura Kumar', 'repairs_maintenance'],
  ] as const) {
    supplier[key] = await admin<Row>('POST', '/inventory/suppliers', {
      supplierName: name, contactPerson: contact, phoneNumber: '0370000000', defaultCategoryId: await categoryId(category),
    });
  }

  const type: Record<string, Row> = {};
  for (const [code, name, category, unit, allocation, isFeed, finance, description] of [
    ['feed', 'Feed', 'feed', 'kg', false, true, 'feed_raw_materials', 'Feed raw materials'],
    ['vaccine', 'Vaccine', 'health', 'dose', true, false, 'medicine_vaccines', 'Vaccines'],
    ['medicine', 'Medicine', 'health', 'unit', true, false, 'medicine_vaccines', 'Medicines and supplements'],
    ['litter', 'Litter & bedding', 'operations', 'bag', true, false, 'litter_bedding', 'Wood shavings and other bedding'],
    ['consumable', 'Consumable', 'operations', 'unit', true, false, 'farm_consumables', 'Disinfectant and other consumables'],
    ['equipment', 'Equipment', 'assets', 'unit', false, false, 'equipment_purchase', 'Tracked equipment'],
  ] as const) {
    type[code] = await admin<Row>('POST', '/inventory/item-types', {
      typeCode: code, typeName: name, category, defaultUnit: unit, allowsBatchAllocation: allocation, isFeed,
      financeCategoryId: await categoryId(finance), description,
    });
  }

  const item: Record<string, Row> = {};
  for (const [key, name, typeCode, sup, unit, cost, reorder] of [
    ['corn', 'Corn', 'feed', 'agri', 'kg', 120, 3000],
    ['soya', 'Soya meal', 'feed', 'agri', 'kg', 260, 1000],
    ['fish', 'Fish meal', 'feed', 'agri', 'kg', 450, 500],
    ['premix', 'Vitamin premix', 'feed', 'agri', 'kg', 900, 100],
    ['nd', 'Newcastle vaccine', 'vaccine', 'acme', 'dose', 5, 2000],
    ['ibd', 'Gumboro vaccine', 'vaccine', 'acme', 'dose', 6, 2000],
    ['vitamins', 'Vitamins & electrolytes', 'medicine', 'acme', 'sachet', 450, 20],
    ['disinfectant', 'Disinfectant', 'consumable', 'acme', 'litre', 1150, 15],
    ['shavings', 'Wood shavings', 'litter', 'acme', 'bag', 350, 50],
  ] as const) {
    item[key] = await admin<Row>('POST', '/inventory/items', {
      itemTypeId: type[typeCode].id, ingredientName: name, supplierId: supplier[sup].id, quantity: 0, unit, costPerUnit: cost, reorderLevel: reorder,
    });
  }

  const recipe: Record<string, Row> = {};
  for (const [key, name, feedType, mix, protein] of [
    ['starter', 'Broiler Starter', 'starter', [55, 35, 8, 2], 22],
    ['grower', 'Broiler Grower', 'grower', [60, 30, 7, 3], 20],
    ['finisher', 'Broiler Finisher', 'finisher', [65, 28, 5, 2], 18],
  ] as const) {
    const created = await admin<Row>('POST', '/feed/recipes', {
      recipeName: name, feedType, cost: 0, targetProtein: protein, targetEnergy: 3000, targetFiber: 4, targetCalcium: 1,
      ingredients: (['corn', 'soya', 'fish', 'premix'] as const).map((k, i) => ({ inventoryItemId: item[k].id, proportion: mix[i], unit: 'kg' })),
    });
    recipe[key] = created.recipe;
  }
  const RECIPE_MIX: Record<string, number[]> = { starter: [55, 35, 8, 2], grower: [60, 30, 7, 3], finisher: [65, 28, 5, 2] };

  // The vaccination programme uses real stock, so marking a task done draws from the farm's store
  log('Health programme');
  const [template] = await db.select().from(schema.healthScheduleTemplates).limit(1);
  const templateItems = await db.select().from(schema.healthScheduleItems).where(eq(schema.healthScheduleItems.templateId, template.id)).orderBy(asc(schema.healthScheduleItems.dayOfAge));
  const stockFor = (name: string) => (/Gumboro/.test(name) ? { id: item.ibd.id, dose: 1000 } : /Newcastle/.test(name) ? { id: item.nd.id, dose: 1000 } : { id: item.vitamins.id, dose: 2 });
  await admin('PUT', `/farm/health-templates/${template.id}`, {
    name: 'Broiler programme (test data)',
    description: 'Five tasks from day 1 to day 24. Each one uses stock from the farm store.',
    isDefault: true,
    status: 'active',
    items: templateItems.map((row) => ({
      dayOfAge: row.dayOfAge, taskType: row.taskType, name: row.name, method: row.method,
      inventoryItemId: stockFor(row.name).id, dosePer1000Birds: stockFor(row.name).dose, notes: row.notes,
    })),
  });

  // ─── 4. Buying: every purchase-order state a tester needs ──────────────────
  log('Purchase orders and deliveries');
  type Line = [keyof typeof item & string, number, number];
  const order = async (api: Api, sup: string, date: string, costCentreId: number, deliverTo: number, lines: Line[], notes: string) => {
    const po = await api<Row>('POST', '/inventory/purchase-orders', {
      supplierId: supplier[sup].id, orderDate: date, expectedDeliveryDate: day(2, date), costCentreId, deliveryLocationId: deliverTo, notes,
      items: lines.map(([k, quantity, price]) => ({ inventoryItemId: item[k].id, orderedQuantity: quantity, unitPrice: price, unit: item[k].unit })),
    });
    const poItems = await db.select().from(schema.purchaseOrderItems).where(eq(schema.purchaseOrderItems.purchaseOrderId, po.id));
    return { id: po.id as number, lineId: (k: string) => poItems.find((row) => row.inventoryItemId === item[k].id)!.id };
  };
  const submit = (api: Api, poId: number) => api<Row>('PUT', `/inventory/purchase-orders/${poId}/status`, { status: 'submitted' });
  const receive = (poId: number, date: string, locationId: number, lines: Array<{ itemId: number; receivedQuantity: number; expiryDate?: string | null }>) =>
    receivePurchaseOrder({ purchaseOrderId: poId, receivedDate: date, locationId, userId: adminUserId, lines });
  const invoice = (sup: string, poId: number, reference: string, date: string, dueDate: string, amount: number) =>
    admin<Row>('POST', '/inventory/supplier-invoices', { supplierId: supplier[sup].id, purchaseOrderId: poId, invoiceReference: reference, invoiceDate: date, dueDate, invoiceAmount: amount });
  const approveInvoice = (id: number) => admin('PUT', `/inventory/supplier-invoices/${id}/review`, { status: 'approved', approvalNotes: 'Checked against the delivery note' });
  const paySupplier = (sup: string, body: Row) => admin<Row>('POST', `/inventory/suppliers/${supplier[sup].id}/payments`, body);

  // PO 1: first feed materials, received, invoiced and paid in full
  const poFeed1 = await order(admin, 'agri', day(-72), cc.mill, store.mill, [['corn', 14520, 118], ['soya', 7200, 255], ['fish', 1566, 440], ['premix', 564, 880]], 'Opening raw materials for the mill');
  await submit(admin, poFeed1.id);
  await receive(poFeed1.id, day(-70), store.mill, [
    { itemId: poFeed1.lineId('corn'), receivedQuantity: 14520 }, { itemId: poFeed1.lineId('soya'), receivedQuantity: 7200 },
    { itemId: poFeed1.lineId('fish'), receivedQuantity: 1566 }, { itemId: poFeed1.lineId('premix'), receivedQuantity: 564 },
  ]);
  const invFeed1 = await invoice('agri', poFeed1.id, 'INV-AF-1001', day(-70), day(-56), 4_734_720);
  await approveInvoice(invFeed1.id);
  await paySupplier('agri', { supplierInvoiceId: invFeed1.id, purchaseOrderId: poFeed1.id, paymentDate: day(-60), financeAccountId: current.id, paymentMethod: 'bank_transfer', amount: 4_734_720, referenceNumber: 'BT-AF-1001' });

  // PO 2: vaccines, medicine, litter into the Main store; paid by cheque
  const poHealth1 = await order(admin, 'acme', day(-71), cc.main, store.main, [['nd', 17000, 5], ['ibd', 20000, 6], ['vitamins', 105, 450], ['disinfectant', 60, 1150], ['shavings', 400, 350]], 'Health and bedding stock for the season');
  await submit(admin, poHealth1.id);
  await receive(poHealth1.id, day(-70), store.main, [
    { itemId: poHealth1.lineId('nd'), receivedQuantity: 17000, expiryDate: day(25) },
    { itemId: poHealth1.lineId('ibd'), receivedQuantity: 20000, expiryDate: day(150) },
    { itemId: poHealth1.lineId('vitamins'), receivedQuantity: 105, expiryDate: day(300) },
    { itemId: poHealth1.lineId('disinfectant'), receivedQuantity: 60 },
    { itemId: poHealth1.lineId('shavings'), receivedQuantity: 400 },
  ]);
  const invHealth1 = await invoice('acme', poHealth1.id, 'INV-AC-2001', day(-70), day(-56), 461_250);
  await approveInvoice(invHealth1.id);
  await paySupplier('acme', { supplierInvoiceId: invHealth1.id, purchaseOrderId: poHealth1.id, paymentDate: day(-62), financeAccountId: current.id, paymentMethod: 'cheque', chequeLeafId: leaves[0].id, amount: 461_250, referenceNumber: 'CHQ-100101' });
  await admin('PUT', `/treasury/cheque-leaves/${leaves[0].id}/status`, { status: 'cleared', effectiveDate: day(-58), notes: 'Presented by Acme Suppliers' });

  log('Stock moved to the farm stores');
  const move = (date: string, to: number, lines: Array<[string, number]>, notes: string) => admin('POST', '/inventory/transfers', {
    fromLocationId: store.main, toLocationId: to, transferDate: date, notes, lines: lines.map(([k, quantity]) => ({ inventoryItemId: item[k].id, quantity })),
  });
  await move(day(-69), store.mainFarm, [['nd', 4000], ['ibd', 4000], ['vitamins', 20], ['disinfectant', 20], ['shavings', 200]], 'Main Farm opening stock');
  // Exactly what the first Expansion 1 batch (EX-HB-001) will use, so the stores end up the same without it
  await move(day(-69), store.expansion, [['nd', 5000], ['ibd', 5000], ['vitamins', 5], ['shavings', 100]], 'Expansion 1 stock for House B');

  // ─── 5. Feed mill: first runs ───────────────────────────────────────────────
  log('Feed mill runs');
  const run: Record<string, Row> = {};
  const startRun = async (key: string, recipeKey: string, kg: number, date: string, notes: string) => {
    const created = await saman<Row>('POST', '/feed/production', { recipeId: recipe[recipeKey].id, plannedQuantity: kg, unit: 'kg', productionDate: date, scheduledDate: date, notes });
    run[key] = { ...created.production, recipeKey, kg };
    return run[key];
  };
  const completeRun = async (key: string, recipeKey: string, kg: number, date: string, waste = 0) => {
    const production = await startRun(key, recipeKey, kg, date, `${recipe[recipeKey].recipeName} run`);
    await saman('PUT', `/feed/production/${production.id}/status`, { status: 'in_progress' });
    const mix = RECIPE_MIX[recipeKey];
    await saman('POST', `/feed/production/${production.id}/complete`, {
      actualQuantity: kg - waste,
      wasteQuantity: waste || null,
      wasteReason: waste ? 'Spillage at the mixer' : null,
      materials: (['corn', 'soya', 'fish', 'premix'] as const).map((k, i) => ({ inventoryItemId: item[k].id, actualQuantity: (kg * mix[i]) / 100 })),
    });
    await saman('POST', `/feed/production/${production.id}/qc`, { qcNotes: 'Sample checked: texture and moisture fine' }).catch(() => undefined);
    return production;
  };
  const distribute = (runKey: string, batchId: number, kg: number, date: string) => saman('POST', '/feed/distribution', {
    productionBatchId: run[runKey].id, farmBatchId: batchId, feedType: run[runKey].recipeKey, quantity: kg, unit: 'kg', distributionDate: date, notes: null,
  });

  await completeRun('R1', 'starter', 3000, day(-68));
  await completeRun('R2', 'grower', 3000, day(-56));
  await completeRun('R3', 'finisher', 3500, day(-46), 40);
  // Feed for the first Expansion 1 batch: made and sent in full, nothing left at the mill
  await completeRun('X1', 'starter', 1600, day(-67));
  await completeRun('X2', 'grower', 3400, day(-55));
  await completeRun('X3', 'finisher', 4000, day(-45));

  // ─── 6. Batches ─────────────────────────────────────────────────────────────
  const rand = seededRandom(20261002);
  const CAUSES = ['Weakness', 'Disease', 'Unknown', 'Suffocation'];

  /** Create a batch with its chicks and their payment. */
  const placeBatch = async (api: Api, code: string, siteId: number, houseName: string, delivered: number, doa: number, unitCost: number, placedOn: string, costCentreId: number, reference: string) => {
    const batch = await api<Row>('POST', '/batches', {
      batchCode: code, siteId, cageId: house[houseName].id, chicksPlaced: delivered - doa, placementDate: placedOn,
      expectedDeliveryDate: day(36, placedOn), notes: `${delivered - doa} chicks from Lanka Hatcheries`,
    });
    await api('POST', `/batches/${batch.id}/chick-placement`, {
      supplierId: supplier.hatchery.id, placementDate: placedOn, invoiceReference: reference, deliveredQuantity: delivered, mortalityOnArrival: doa, unitCost,
    });
    await pay({ date: placedOn, amount: (delivered - doa) * unitCost, category: 'chicks', costCentreId, batchId: batch.id, narrative: `Day-old chicks for ${code}`, counterparty: 'Lanka Hatcheries', reference });
    return batch;
  };

  /** Daily checks for a range of ages. Deaths are spread so the batch total comes out exactly. */
  const dailyChecks = async (api: Api, batch: Row, placedOn: string, birds: number, fromAge: number, toAge: number, deathsByAge: number[], skipAges: number[] = [], soldBefore: (date: string) => number = () => 0) => {
    for (let age = fromAge; age <= toAge; age += 1) {
      if (skipAges.includes(age)) continue;
      const date = day(age, placedOn);
      const deadSoFar = deathsByAge.slice(0, age).reduce((a, b) => a + b, 0);
      const live = birds - deadSoFar - soldBefore(date);
      const feedPerBird = curve(FEED_CURVE, age + 1) - curve(FEED_CURVE, age);
      await api('POST', `/farm/batches/${batch.id}/today`, {
        date,
        mortalityCount: deathsByAge[age],
        mortalityCause: deathsByAge[age] > 0 ? CAUSES[Math.floor(rand() * CAUSES.length)] : null,
        feedConsumption: Math.round((live * feedPerBird) / 1000),
        waterConsumption: Math.round((live * feedPerBird * 1.9) / 1000),
        averageWeight: age % 7 === 0 || age === toAge ? Math.round(curve(WEIGHT_CURVE, age) * (0.97 + rand() * 0.05)) : null,
        temperature: Math.round((32 - Math.min(age, 28) * 0.35 + rand()) * 10) / 10,
        humidity: 60 + Math.floor(rand() * 10),
        notes: null,
      });
    }
  };
  const spreadDeaths = (days: number, total: number) => {
    const series = Array.from({ length: days }, (_, age) => (age < 7 ? 2 + Math.floor(rand() * 3) : Math.floor(rand() * 3)));
    let diff = total - series.reduce((a, b) => a + b, 0);
    for (let i = 0; diff !== 0; i = (i + 1) % days) {
      if (diff > 0) { series[i] += 1; diff -= 1; } else if (series[i] > 0) { series[i] -= 1; diff += 1; }
    }
    return series;
  };
  const healthTasks = (batchId: number) => db.select().from(schema.batchHealthTasks).where(eq(schema.batchHealthTasks.batchId, batchId)).orderBy(asc(schema.batchHealthTasks.dayOfAge));
  const completeTasks = async (api: Api, batchId: number, upToAge: number) => {
    for (const task of await healthTasks(batchId)) {
      if (task.dayOfAge > upToAge || task.status !== 'pending') continue;
      await api('POST', `/farm/health-tasks/${task.id}/complete`, { completedDate: String(task.dueDate).slice(0, 10), notes: 'Given at first light' });
    }
  };

  // Batch A: finished and sold. It becomes the closed batch in the history.
  log('Batch MF-H1-001 (finished and sold)');
  const placedA = day(-70);
  const batchA = await placeBatch(nimal, 'MF-H1-001', siteOf.main, 'House 1', 2020, 20, 150, placedA, cc.main, 'LH-7001');
  await admin('POST', `/inventory/items/${item.shavings.id}/consume-site`, { siteId: siteOf.main, quantity: 80, consumptionDate: day(-70), notes: 'Bedding for House 1' });
  await distribute('R1', batchA.id, 1200, day(-69));
  await distribute('R2', batchA.id, 2800, day(-56));
  await distribute('R3', batchA.id, 3200, day(-46));
  const deathsA = spreadDeaths(35, 60);
  await dailyChecks(nimal, batchA, placedA, 2000, 0, 34, deathsA);
  await completeTasks(nimal, batchA.id, 34);

  // Costs while batch A was growing
  await pay({ date: day(-55), amount: 60_000, category: 'insurance', costCentreId: cc.admin, narrative: 'Annual stock insurance premium', counterparty: 'Ceylinco Insurance', reference: 'POL-88120' });
  await pay({ date: day(-50), amount: 45_000, category: 'electricity', costCentreId: cc.mill, narrative: 'Mill electricity', counterparty: 'CEB', reference: 'CEB-MILL-01' });
  await pay({ date: day(-50), amount: 30_000, category: 'electricity', costCentreId: cc.main, narrative: 'Main Farm electricity', counterparty: 'CEB', reference: 'CEB-MF-01' });
  await pay({ date: day(-45), amount: 2_500, category: 'bank_charges', costCentreId: cc.admin, narrative: 'Monthly bank charges', counterparty: 'Commercial Bank' });
  await admin('POST', `/finance/loans/${bankLoan.id}/repayments`, { paymentDate: day(-42), principalAmount: 125_000, interestAmount: 30_000, financeAccountId: current.id, reference: 'LOAN-REP-01' });

  // Petty cash float held by the Main Farm manager
  const allocation = await admin<Row>('POST', '/treasury/petty-cash/allocations', {
    sourceFinanceAccountId: safe.id, pettyCashAccountId: petty.id, allocatedToUserId: nimalUserId, amount: 50_000, allocationDate: day(-40), purpose: 'Main Farm day-to-day float',
  });
  const pettyExpense = async (date: string, amount: number, category: string, justification: string, review: boolean) => {
    const expense = await nimal<Row>('POST', `/treasury/petty-cash/allocations/${allocation.id}/expenses`, {
      expenseDate: date, categoryId: await categoryId(category), costCentreId: cc.main, amount, justification,
    });
    if (review) await admin('PUT', `/treasury/petty-cash/expenses/${expense.id}/review`, { status: 'approved', reviewNotes: 'Receipt seen' });
    return expense;
  };
  await pettyExpense(day(-36), 8_500, 'fuel_gas', 'Diesel for the generator', true);

  // Sales of batch A
  log('Sales of the finished batch');
  const buyer: Record<string, Row> = {};
  for (const [key, name, contact, terms, limit] of [
    ['fresh', 'Fresh Mart', 'Chamari Wickrama', 14, 3_000_000],
    ['city', 'City Poultry', 'Imran Hameed', 0, null],
    ['lanka', 'Lanka Chicken Co', 'Dinesh Alwis', 30, 2_000_000],
    ['afflan', 'Afflan Traders', 'M. Afflan', 7, 100_000],
    ['wayamba', 'Wayamba Processors', 'Nalin Herath', 7, 5_000_000],
  ] as const) {
    buyer[key] = await admin<Row>('POST', '/buyers', { buyerName: name, contactPerson: contact, phoneNumber: '0770000000', creditTerms: terms, creditLimit: limit });
  }
  const sell = async (buyerKey: string, batchId: number, date: string, lorries: Array<[string, number, number, number]>, price: number, review = true) => {
    const sale = await admin<Row>('POST', '/sales', {
      saleType: 'live_birds', batchId, buyerId: buyer[buyerKey].id, saleDate: date, pricePerKg: price,
      lorries: lorries.map(([lorryNumber, birdsCount, previousWeight, loadedWeight]) => ({ lorryNumber, birdsCount, previousWeight, loadedWeight })),
    });
    if (review) await admin('PUT', `/sales/${sale.id}`, { status: 'reviewed' });
    return sale;
  };
  const receipt = (saleId: number, date: string, lines: Row[]) => admin<Row>('POST', `/sales/${saleId}/payments`, { receiptDate: date, lines });

  const saleA1 = await sell('fresh', batchA.id, day(-35), [['WP LK-4521', 1000, 3200, 5360]], 640);
  const saleA2 = await sell('city', batchA.id, day(-35), [['NW PG-1180', 600, 2900, 4190]], 635);
  await sell('lanka', batchA.id, day(-35), [['WP KX-9034', 340, 2850, 3581]], 640);
  await receipt(saleA2.id, day(-35), [{ paymentAmount: 400_000, paymentMethod: 'bank_transfer', financeAccountId: current.id, referenceNumber: 'CP-TRF-5501' }]);
  await receipt(saleA1.id, day(-28), [{ paymentAmount: 1_382_400, paymentMethod: 'bank_transfer', financeAccountId: current.id, referenceNumber: 'FM-TRF-9102' }]);
  const litter = await admin<Row>('POST', '/sales', {
    saleType: 'other_income', siteId: siteOf.main, buyerId: buyer.city.id, saleDate: day(-31), itemDescription: 'Used litter', quantity: 100, unit: 'bag', unitPrice: 200,
  });
  await admin('PUT', `/sales/${litter.id}`, { status: 'reviewed' });
  await receipt(litter.id, day(-31), [{ paymentAmount: 20_000, paymentMethod: 'cash', financeAccountId: safe.id }]);

  // Batch D: a second finished batch, on the other farm, with weaker results, so closed batches can be compared
  log('Batch EX-HB-001 (finished and sold, Expansion 1)');
  const placedD = day(-68);
  const batchD = await placeBatch(dilani, 'EX-HB-001', siteOf.expansion, 'House B', 2520, 20, 150, placedD, cc.expansion, 'LH-7009');
  await admin('POST', `/inventory/items/${item.shavings.id}/consume-site`, { siteId: siteOf.expansion, quantity: 100, consumptionDate: day(-69), notes: 'Bedding for House B' });
  await distribute('X1', batchD.id, 1600, day(-67));
  await distribute('X2', batchD.id, 3400, day(-55));
  await distribute('X3', batchD.id, 4000, day(-45));
  const deathsD = spreadDeaths(35, 125);
  await dailyChecks(dilani, batchD, placedD, 2500, 0, 34, deathsD);
  await completeTasks(dilani, batchD.id, 34);
  const saleD = await sell('wayamba', batchD.id, day(-33), [['NC LM-2207', 1300, 3200, 5850], ['NC LM-2208', 1075, 3000, 5190]], 632);
  await receipt(saleD.id, day(-26), [{ paymentAmount: 3_058_880, paymentMethod: 'bank_transfer', financeAccountId: current.id, referenceNumber: 'WP-TRF-3307' }]);

  // ─── 7. Second round of buying and milling ─────────────────────────────────
  log('Second feed order (part paid)');
  const poFeed2 = await order(admin, 'agri', day(-36), cc.mill, store.mill, [['corn', 8000, 122], ['soya', 4000, 262], ['fish', 900, 455], ['premix', 350, 900]], 'Second raw material order');
  await submit(admin, poFeed2.id);
  await receive(poFeed2.id, day(-34), store.mill, [
    { itemId: poFeed2.lineId('corn'), receivedQuantity: 8000 }, { itemId: poFeed2.lineId('soya'), receivedQuantity: 4000 },
    { itemId: poFeed2.lineId('fish'), receivedQuantity: 900 }, { itemId: poFeed2.lineId('premix'), receivedQuantity: 350 },
  ]);
  const invFeed2 = await invoice('agri', poFeed2.id, 'INV-AF-1002', day(-34), day(-20), 2_748_500);
  await approveInvoice(invFeed2.id);
  await paySupplier('agri', { supplierInvoiceId: invFeed2.id, purchaseOrderId: poFeed2.id, paymentDate: day(-15), financeAccountId: current.id, paymentMethod: 'bank_transfer', amount: 1_500_000, referenceNumber: 'BT-AF-1002A' });

  await completeRun('R4', 'starter', 4000, day(-32));

  // Batch B: 33 days old today, the one the sales tests use
  log('Batch MF-H2-002 (ready to sell)');
  const placedB = day(-33);
  const batchB = await placeBatch(nimal, 'MF-H2-002', siteOf.main, 'House 2', 3030, 30, 155, placedB, cc.main, 'LH-7044');
  await admin('POST', `/inventory/items/${item.shavings.id}/consume-site`, { siteId: siteOf.main, quantity: 100, consumptionDate: day(-34), notes: 'Bedding for House 2' });
  await move(day(-30), store.mainFarm, [['nd', 7000], ['ibd', 6000]], 'Vaccines for House 2');
  await distribute('R1', batchB.id, 1800, day(-33));
  await distribute('R2', batchB.id, 200, day(-23));
  await completeRun('R5', 'grower', 5000, day(-19));
  await distribute('R5', batchB.id, 4300, day(-19));
  const deathsB = spreadDeaths(33, 70);
  await dailyChecks(nimal, batchB, placedB, 3000, 0, 30, deathsB);
  await completeTasks(nimal, batchB.id, 21);
  await admin('POST', '/farm/vet-visits', {
    siteId: siteOf.main, batchId: batchB.id, visitDate: day(-10), vetName: 'Dr. S. Perera', reason: 'Routine visit',
    findings: 'Birds active and even. Litter slightly damp near the drinkers.', diagnosis: 'No disease found', treatment: 'Raise drinker lines; turn litter', feeAmount: 15_000, followUpDate: day(4),
  });

  await pay({ date: day(-20), amount: 48_000, category: 'electricity', costCentreId: cc.mill, narrative: 'Mill electricity', counterparty: 'CEB', reference: 'CEB-MILL-02' });
  await pay({ date: day(-20), amount: 32_000, category: 'electricity', costCentreId: cc.main, narrative: 'Main Farm electricity', counterparty: 'CEB', reference: 'CEB-MF-02' });
  await pay({ date: day(-15), amount: 2_500, category: 'bank_charges', costCentreId: cc.admin, narrative: 'Monthly bank charges', counterparty: 'Commercial Bank' });
  await pettyExpense(day(-22), 6_200, 'repairs_maintenance', 'Drinker line fittings', true);
  await admin('POST', `/finance/loans/${bankLoan.id}/repayments`, { paymentDate: day(-12), principalAmount: 125_000, interestAmount: 29_000, financeAccountId: current.id, reference: 'LOAN-REP-02' });

  // Second vaccine order: received and invoiced, not yet paid (a payable that is not yet due)
  const poHealth2 = await order(admin, 'acme', day(-22), cc.expansion, store.main, [['nd', 8000, 5.5]], 'Newcastle vaccine top-up');
  await submit(admin, poHealth2.id);
  await receive(poHealth2.id, day(-20), store.main, [{ itemId: poHealth2.lineId('nd'), receivedQuantity: 8000, expiryDate: day(240) }]);
  const invHealth2 = await invoice('acme', poHealth2.id, 'INV-AC-2003', day(-20), day(10), 44_000);
  await approveInvoice(invHealth2.id);

  // Batch C: young batch on the other farm
  log('Batch EX-HA-001 (young batch on Expansion 1)');
  const placedC = day(-14);
  await move(day(-15), store.expansion, [['nd', 3000], ['ibd', 3000], ['vitamins', 10], ['disinfectant', 10], ['shavings', 100]], 'Expansion 1 opening stock');
  const batchC = await placeBatch(dilani, 'EX-HA-001', siteOf.expansion, 'House A', 2520, 20, 150, placedC, cc.expansion, 'LH-7102');
  await admin('POST', `/inventory/items/${item.shavings.id}/consume-site`, { siteId: siteOf.expansion, quantity: 80, consumptionDate: day(-15), notes: 'Bedding for House A' });
  await distribute('R4', batchC.id, 1500, day(-14));
  const deathsC = spreadDeaths(14, 30);
  // No check was entered yesterday, so Home shows a missing daily log for this batch.
  // The day-14 Gumboro vaccination falls due today, ready for the health-task test.
  await dailyChecks(dilani, batchC, placedC, 2500, 0, 12, deathsC);
  await completeTasks(dilani, batchC.id, 7);
  await pay({ date: day(-8), amount: 12_000, category: 'electricity', costCentreId: cc.expansion, narrative: 'Expansion 1 electricity', counterparty: 'CEB', reference: 'CEB-EX-01' });
  await admin('POST', '/finance/owner-money', { direction: 'out', amount: 150_000, date: day(-7), financeAccountId: current.id, reference: 'DRW-001', notes: 'Owner drawings' });

  await completeRun('R6', 'finisher', 5000, day(-6));
  await distribute('R6', batchB.id, 3500, day(-6));

  // ─── 8. Sales on the batch that is ready ───────────────────────────────────
  log('Sales, cheques and bookings on MF-H2-002');
  const saleB1 = await sell('lanka', batchB.id, day(-2), [['WP KX-9034', 400, 2850, 3650]], 640);
  await receipt(saleB1.id, day(-2), [
    { paymentAmount: 300_000, paymentMethod: 'cheque', financeAccountId: current.id, chequeNumber: '445501', chequeDate: day(-2), bankName: 'Sampath Bank' },
    { paymentAmount: 212_000, paymentMethod: 'cheque', financeAccountId: current.id, chequeNumber: '445502', chequeDate: day(5), bankName: 'Sampath Bank' },
  ]);
  await sell('afflan', batchB.id, day(-2), [['NW CA-7710', 50, 1500, 1600]], 640);
  const soldB = (date: string) => (date >= day(-2) ? 450 : 0) + (date >= day(-1) ? 300 : 0);
  await dailyChecks(nimal, batchB, placedB, 3000, 31, 31, deathsB, [], soldB);
  await sell('city', batchB.id, day(-1), [['NW PG-1180', 300, 2900, 3515]], 635, false);
  await dailyChecks(nimal, batchB, placedB, 3000, 32, 32, deathsB, [], soldB);

  await admin('POST', '/sale-bookings', { buyerId: buyer.fresh.id, batchId: batchB.id, catchDate: day(1), expectedBirds: 1000, expectedAvgWeightKg: 2.1, pricePerKg: 640, notes: 'Lorry arrives 5 am' });
  await admin('POST', '/sale-bookings', { buyerId: buyer.lanka.id, batchId: batchB.id, catchDate: day(3), expectedBirds: 600, expectedAvgWeightKg: 2.2, pricePerKg: 645, notes: null });

  // ─── 9. Stock left in every state ──────────────────────────────────────────
  log('Open purchase orders, requests, service work');
  // Part received and already billed in full: the invoice shows as over-billed until the rest arrives
  const poFeed3 = await order(admin, 'agri', day(-5), cc.mill, store.mill, [['corn', 8000, 125], ['soya', 4000, 265]], 'Third raw material order');
  await submit(admin, poFeed3.id);
  await receive(poFeed3.id, day(-3), store.mill, [{ itemId: poFeed3.lineId('corn'), receivedQuantity: 5000 }]);
  await invoice('agri', poFeed3.id, 'INV-AF-1003', day(-3), day(11), 2_060_000);

  // Submitted, nothing received yet
  const poOpen = await order(admin, 'acme', day(-1), cc.expansion, store.main, [['nd', 5000, 5.5], ['vitamins', 50, 460]], 'Vaccine and vitamins, delivery expected');
  await submit(admin, poOpen.id);
  // Still a draft
  await order(admin, 'acme', TODAY, cc.main, store.main, [['disinfectant', 40, 1200]], 'Disinfectant for the House 1 clean-out');

  // Requests from the farms: one waiting, one approved and ready to order
  await nimal('POST', '/inventory/requisitions', {
    costCentreId: cc.main, deliveryLocationId: store.mainFarm, neededBy: day(5), notes: 'Running low before the next placement',
    items: [{ inventoryItemId: item.vitamins.id, quantity: 20 }, { inventoryItemId: item.disinfectant.id, quantity: 10 }],
  });
  const requestB = await kamal<Row>('POST', '/inventory/requisitions', {
    costCentreId: cc.expansion, deliveryLocationId: store.expansion, neededBy: day(7), notes: 'Bedding for House B',
    items: [{ inventoryItemId: item.shavings.id, quantity: 80 }],
  });
  await admin('PUT', `/inventory/requisitions/${requestB.id}/review`, { status: 'approved', reviewNotes: 'Go ahead' });

  // Service work: one approved and waiting to be paid, one waiting for review
  const repair = await admin<Row>('POST', '/inventory/service-work-orders', {
    serviceType: 'maintenance', title: 'House 2 fan motor rewind', supplierId: supplier.power.id, allocationType: 'site', siteId: siteOf.main,
    serviceDate: day(-9), invoiceReference: 'CPS-3301', totalAmount: 35_000, categoryId: await categoryId('repairs_maintenance'), costCentreId: cc.main,
  });
  await admin('PUT', `/inventory/service-work-orders/${repair.id}/review`, { status: 'approved', approvalNotes: 'Work checked by the farm manager' });
  await admin('POST', '/inventory/service-work-orders', {
    serviceType: 'maintenance', title: 'Hammer mill screen replacement', supplierId: supplier.power.id, allocationType: 'mill',
    serviceDate: day(-4), invoiceReference: 'CPS-3340', totalAmount: 28_000, categoryId: await categoryId('repairs_maintenance'), costCentreId: cc.mill,
  });

  // Mill: one run planned for today, one started and waiting to be completed
  await startRun('R7', 'grower', 2000, TODAY, 'Planned grower run');
  await startRun('R8', 'starter', 1500, day(-1), 'Starter run in progress');
  await saman('PUT', `/feed/production/${run.R8.id}/status`, { status: 'in_progress' });

  // Money waiting for someone
  await pettyExpense(day(-2), 2_400, 'staff_welfare', 'Tea and snacks for the catching crew', false);
  await admin('POST', '/treasury/expenses/operational', {
    expenseDate: day(-3), categoryId: await categoryId('water'), counterpartyName: 'Wayamba Water Supply', siteId: siteOf.main, costCentreId: cc.main, amount: 18_000, notes: 'Water bowser, two loads',
  });

  // ─── 10. People, attendance, payroll ───────────────────────────────────────
  log('Employees and pay');
  const staff: Record<string, Row> = {};
  for (const [key, firstName, lastName, designation, siteId, centre, employmentType, epf, payType, rate, bank, allowances] of [
    ['nimal', 'Nimal', 'Perera', 'Farm Manager', siteOf.main, null, 'permanent', 'EPF-1001', 'monthly', 85_000, true, [['Transport allowance', 5_000, false]]],
    ['sunil', 'Sunil', 'Bandara', 'Worker', siteOf.main, null, 'permanent', 'EPF-1002', 'monthly', 45_000, true, [['Cost of living allowance', 3_500, true]]],
    ['kumari', 'Kumari', 'Dias', 'Worker', siteOf.main, null, 'permanent', 'EPF-1003', 'monthly', 42_000, true, []],
    ['ajith', 'Ajith', 'Kumara', 'Worker', siteOf.main, null, 'seasonal', null, 'daily', 2_000, false, []],
    ['kamal', 'Kamal', 'Silva', 'Supervisor', siteOf.expansion, null, 'permanent', 'EPF-1004', 'monthly', 60_000, true, []],
    ['priya', 'Priya', 'Rajapaksa', 'Worker', siteOf.expansion, null, 'permanent', 'EPF-1005', 'monthly', 42_000, true, []],
    ['saman', 'Saman', 'Wijesinghe', 'Feed Mill Operator', siteOf.main, cc.mill, 'permanent', 'EPF-1006', 'monthly', 55_000, true, []],
    ['ruwan', 'Ruwan', 'Fernando', 'Accountant', siteOf.main, cc.admin, 'permanent', 'EPF-1007', 'monthly', 75_000, true, []],
  ] as const) {
    staff[key] = await admin<Row>('POST', '/employees', {
      firstName, lastName, designation, siteId, ...(centre ? { costCentreId: centre } : {}), employmentType, joinDate: '2025-01-06', phone: '0710000000',
      ...(epf ? { epfNumber: epf, epfEligible: true } : { epfEligible: false }),
      emergencyContacts: [{ contactName: `${lastName} family`, relationship: 'Spouse', phoneNumber: '0720000000' }],
      ...(bank ? { bankDetails: { accountHolderName: `${firstName} ${lastName}`, bankName: 'Peoples Bank', branchCode: '012', accountNumber: `00${1000 + Object.keys(staff).length}7788` } } : {}),
    });
    await admin('POST', `/employees/${staff[key].id}/compensation/revisions`, {
      payType, baseRate: rate, overtimeRate: payType === 'monthly' ? Math.round(rate / 200) : 300, effectiveFrom: '2025-01-06', isActive: true,
      components: (allowances as ReadonlyArray<readonly [string, number, boolean]>).map(([name, value, countsForEpf]) => ({ componentType: 'earning', name, calculationType: 'fixed', value, countsForEpf, isActive: true })),
    });
  }
  const everyone = Object.values(staff);

  const dayShift = await admin<Row>('POST', '/shifts', { shiftName: 'Day shift', startTime: '06:00', endTime: '14:00' });
  await admin('POST', '/shifts', { shiftName: 'Night watch', startTime: '18:00', endTime: '06:00' });
  const year = Number(TODAY.slice(0, 4));
  await admin('POST', '/leave-balances/bulk', {
    year,
    balances: everyone.filter((e) => e.id !== staff.ajith.id).flatMap((e) => [
      { employeeId: e.id, leaveType: 'casual', totalDays: 7 }, { employeeId: e.id, leaveType: 'earned', totalDays: 14 }, { employeeId: e.id, leaveType: 'medical', totalDays: 7 },
    ]),
  });

  log('Attendance');
  // Mon–Sat are working days. A few absences and leave days so the pay figures are not all identical.
  // Counted in working days, so an absence never lands on a Sunday whatever month this is built in
  const working = (m: { days: string[] }) => m.days.filter((date) => weekday(date) !== 0);
  const exceptions = new Map<string, { status: string; leaveType?: string }>([
    [`${staff.kumari.id}:${working(M1)[7]}`, { status: 'absent' }],
    [`${staff.kumari.id}:${working(M1)[8]}`, { status: 'absent' }],
    [`${staff.priya.id}:${working(M1)[13]}`, { status: 'on_leave', leaveType: 'casual' }],
    [`${staff.sunil.id}:${working(M2)[10]}`, { status: 'on_leave', leaveType: 'medical' }],
    [`${staff.kamal.id}:${working(M2)[17]}`, { status: 'half_day', leaveType: 'casual' }],
  ]);
  const workDates = [...M2.days, ...M1.days, ...M0.days.filter((date) => date < TODAY)].filter((date) => weekday(date) !== 0);
  for (const date of workDates) {
    const records = everyone
      // The seasonal worker comes in three days a week
      .filter((e) => e.id !== staff.ajith.id || [1, 3, 5].includes(weekday(date)))
      .map((e) => ({ employeeId: e.id, ...(exceptions.get(`${e.id}:${date}`) ?? { status: 'present' }) }));
    await admin('POST', '/attendance/bulk', { attendanceDate: date, shiftId: dayShift.id, records });
  }

  log(`Payroll for ${M2.label} (paid) and advances`);
  // A staff loan from two months ago: one instalment is taken back in the paid month, the rest remain
  await admin('POST', '/payroll/loans', {
    employeeId: staff.kamal.id, loanType: 'loan', principal: 60_000, installmentAmount: 10_000, issuedDate: M2.on(15), firstRecoveryPeriod: M2.key,
    financeAccountId: current.id, paymentMethod: 'bank_transfer', notes: 'Roof repair at home',
  });
  await admin('POST', '/payroll/generate', { payPeriod: M2.start, workingDays: M2.days.filter((date) => weekday(date) !== 0).length });
  const m2Payrolls = await db.select().from(schema.payroll).where(eq(schema.payroll.payPeriod, M2.start));
  for (const row of m2Payrolls) {
    await admin('PUT', `/payroll/${row.id}/status`, { status: 'reviewed' });
    await admin('PUT', `/payroll/${row.id}/status`, { status: 'approved' });
  }
  await admin('POST', '/payroll/pay-period', { payPeriod: M2.key, financeAccountId: current.id, paymentMethod: 'bank_transfer', payDate: M2.end });
  await admin('POST', '/payroll/statutory/remit', { payPeriod: M2.key, financeAccountId: current.id, paidDate: M1.on(12), epfReference: `C-FORM-${M2.key}`, etfReference: `ETF-${M2.key}` });
  // A salary advance last month: it comes back when last month's payroll is run
  await admin('POST', '/payroll/loans', {
    employeeId: staff.sunil.id, loanType: 'advance', principal: 10_000, issuedDate: M1.on(20), firstRecoveryPeriod: M1.key,
    financeAccountId: safe.id, paymentMethod: 'cash', notes: 'School fees',
  });

  // A small vaccine lot that has now expired (for the expiry and write-off tests). It is booked in after
  // everything else has drawn its stock, so the expired doses are still sitting in the Main store.
  const poExpired = await order(admin, 'acme', day(-62), cc.main, store.main, [['ibd', 400, 6]], 'Short-dated Gumboro lot');
  await submit(admin, poExpired.id);
  await receive(poExpired.id, day(-60), store.main, [{ itemId: poExpired.lineId('ibd'), receivedQuantity: 400, expiryDate: day(-3) }]);
  const invExpired = await invoice('acme', poExpired.id, 'INV-AC-2002', day(-60), day(-46), 2_400);
  await approveInvoice(invExpired.id);
  await paySupplier('acme', { supplierInvoiceId: invExpired.id, purchaseOrderId: poExpired.id, paymentDate: day(-58), financeAccountId: safe.id, paymentMethod: 'cash', amount: 2_400, referenceNumber: 'CASH-AC-2002' });


  // ─── 11. Approvals, closing the finished batch, alerts ─────────────────────
  log('Approval limits and a purchase order waiting for approval');
  await admin('PUT', '/approvals/limits', { purchaseOrder: 1_000_000, moneyOut: 250_000 });
  const poWaiting = await order(nimal, 'agri', TODAY, cc.mill, store.mill, [['corn', 10000, 125]], 'Corn while the price holds');
  await submit(nimal, poWaiting.id);

  log('Closing MF-H1-001 and starting the House 1 clean-out');
  await nimal('POST', `/batches/${batchA.id}/close`, { notes: 'All birds accounted for' });
  const [turnaround] = await db.select().from(schema.houseTurnarounds).where(and(eq(schema.houseTurnarounds.cageId, house['House 1'].id), eq(schema.houseTurnarounds.status, 'in_progress')));
  if (turnaround) await nimal('PUT', `/farm/turnarounds/${turnaround.id}`, { litterRemovedDate: day(-33), cleanedDate: day(-31), notes: 'Litter sold to City Poultry' });

  log('Closing EX-HB-001; House B cleaned out and ready again');
  await dilani('POST', `/batches/${batchD.id}/close`, { notes: 'All birds accounted for' });
  const [turnaroundD] = await db.select().from(schema.houseTurnarounds).where(and(eq(schema.houseTurnarounds.cageId, house['House B'].id), eq(schema.houseTurnarounds.status, 'in_progress')));
  if (turnaroundD) {
    await dilani('PUT', `/farm/turnarounds/${turnaroundD.id}`, {
      litterRemovedDate: day(-32), cleanedDate: day(-30), disinfectedDate: day(-28), newLitterDate: day(-20), readyDate: day(-18), notes: 'Ready for the next placement',
    });
  }

  await admin('POST', '/notifications/refresh').catch((error) => log(`  (alerts not refreshed: ${(error as Error).message})`));

  return { batchA, batchB, batchC, batchD };
}
