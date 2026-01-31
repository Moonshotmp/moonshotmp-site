// Central pricing configuration for Moonshot Medical billing
// All prices in cents

export const PRODUCTS = {
  // Test items (for development - set hidden: true when ready for production)
  test: [
    { code: 'test_membership', name: 'Test Membership', price: 250, recurring: true, isTest: true, category: 'test' },
    { code: 'test_item', name: 'Test Item', price: 100, recurring: false, isTest: true, category: 'test' },
  ],

  // Memberships (recurring monthly)
  memberships: [
    { code: 'hrt_membership', name: 'HRT Membership', price: 20800, recurring: true, category: 'memberships' },
    { code: 'weight_loss', name: 'Complete Weight Loss', price: 40500, recurring: true, category: 'memberships' },
    { code: 'rx_oversight', name: 'Prescription + Oversight', price: 10500, recurring: true, category: 'memberships' },
    { code: 'addon_hcg', name: 'HCG Add-on', price: 35000, recurring: true, category: 'memberships' },
    { code: 'addon_enclomiphene', name: 'Enclomiphene Add-on', price: 20800, recurring: true, category: 'memberships' },
    { code: 'addon_tadalafil', name: 'Tadalafil Add-on', price: 7000, recurring: true, category: 'memberships' },
  ],

  // One-time services
  services: [
    { code: 'shot_nad', name: 'NAD+ Shot', price: 6000, recurring: false, category: 'injections' },
    { code: 'shot_vitc', name: 'Vitamin C Shot', price: 6000, recurring: false, category: 'injections' },
    { code: 'shot_b12', name: 'B12 Shot', price: 3000, recurring: false, category: 'injections' },
    { code: 'shot_micb', name: 'MIC B Shot', price: 3000, recurring: false, category: 'injections' },
    { code: 'shot_glutathione', name: 'Glutathione Shot', price: 3000, recurring: false, category: 'injections' },
    { code: 'dexa_scan', name: 'DEXA Scan', price: 15000, recurring: false, category: 'labs' },
    { code: 'blood_panel', name: 'Comprehensive Blood Panel', price: 28500, recurring: false, category: 'labs' },
    { code: 'performance_bundle', name: 'Performance Baseline Bundle', price: 40500, recurring: false, category: 'labs' },
  ],
};

export const DISCOUNTS = {
  family: { code: 'family', percent: 40, appliesToRecurring: true, appliesToOneTime: false, appliesToCodes: ['blood_panel'] },
};

// Get all products as flat array
export function getAllProducts(includeTest = true) {
  const products = [...PRODUCTS.memberships, ...PRODUCTS.services];
  if (includeTest) {
    products.unshift(...PRODUCTS.test);
  }
  return products;
}

// Find product by code
export function getProductByCode(code) {
  const all = getAllProducts(true);
  return all.find(p => p.code === code) || null;
}

// Calculate cart totals
export function calculateCartTotals(cartItems, discountCode = null) {
  const discount = discountCode ? DISCOUNTS[discountCode.toLowerCase()] : null;

  let recurringTotal = 0;
  let oneTimeTotal = 0;
  let recurringDiscount = 0;
  let oneTimeDiscount = 0;

  const lineItems = [];

  for (const item of cartItems) {
    const product = getProductByCode(item.code);
    if (!product) continue;

    const quantity = item.quantity || 1;
    const baseAmount = product.price * quantity;

    let discountAmount = 0;
    if (discount) {
      const codeMatch = Array.isArray(discount.appliesToCodes) && discount.appliesToCodes.includes(product.code);
      if (codeMatch) {
        discountAmount = Math.round(baseAmount * (discount.percent / 100));
      } else if (product.recurring && discount.appliesToRecurring) {
        discountAmount = Math.round(baseAmount * (discount.percent / 100));
      } else if (!product.recurring && discount.appliesToOneTime) {
        discountAmount = Math.round(baseAmount * (discount.percent / 100));
      }
    }

    const finalAmount = baseAmount - discountAmount;

    if (product.recurring) {
      recurringTotal += finalAmount;
      recurringDiscount += discountAmount;
    } else {
      oneTimeTotal += finalAmount;
      oneTimeDiscount += discountAmount;
    }

    lineItems.push({
      code: product.code,
      name: product.name,
      quantity,
      unitPrice: product.price,
      baseAmount,
      discountAmount,
      finalAmount,
      recurring: product.recurring,
    });
  }

  return {
    lineItems,
    recurringTotal,
    oneTimeTotal,
    recurringDiscount,
    oneTimeDiscount,
    grandTotal: recurringTotal + oneTimeTotal,
    discountCode: discount?.code || null,
  };
}

// Get category display info
export const CATEGORIES = [
  { id: 'test', name: 'Test', description: 'Test items for development' },
  { id: 'memberships', name: 'Memberships', description: 'Monthly recurring plans' },
  { id: 'injections', name: 'Injections', description: 'Vitamin & nutrient shots' },
  { id: 'labs', name: 'Labs & Scans', description: 'Blood work and body composition' },
];
