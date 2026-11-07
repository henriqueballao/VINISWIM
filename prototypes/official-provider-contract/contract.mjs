const operations = ['listMeets', 'getEntries', 'getStartlists', 'getResults', 'getUpdates', 'getEvidence'];

export function validateAdapter(adapter) {
  if (typeof adapter?.provider !== 'string' || !adapter.provider.trim() ||
      !Array.isArray(adapter.capabilities)) {
    throw new TypeError('INVALID_PROVIDER_CONTRACT');
  }

  const declared = new Set(adapter.capabilities);
  if (declared.size !== adapter.capabilities.length ||
      adapter.capabilities.some(operation => !operations.includes(operation))) {
    throw new TypeError('INVALID_PROVIDER_CAPABILITIES');
  }

  for (const operation of operations) {
    if (declared.has(operation) !== (typeof adapter[operation] === 'function')) {
      throw new TypeError('CAPABILITY_METHOD_MISMATCH: ' + operation);
    }
  }

  if (declared.size && !declared.has('getEvidence')) {
    throw new TypeError('SOURCE_EVIDENCE_REQUIRED');
  }

  return adapter;
}
