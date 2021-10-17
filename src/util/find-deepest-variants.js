function searchForDeepestOptions(products, results = []) {
  for (const product of products) {
    if (product.options && Array.isArray(product.options) && product.options.length > 0) {
      searchForDeepestOptions(product.options, results);
    } else {
      results.push(product);
    }
  }

  return results;
}

export default function findDeepestVariants(product) {
  if (!product.variants || !Array.isArray(product.variants) || product.variants.length === 0) {
    return [];
  }

  const deepestVariants = searchForDeepestOptions(product.variants);

  return deepestVariants;
}
