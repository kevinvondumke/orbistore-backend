// USD AMOUNTS | SUPPORTED BY CHECKOUT, IN CENTS
export const MIN_PAYMENT_MINOR = 50;
export const MAX_PAYMENT_MINOR = 99_999_999;

// DOLLARS TO MINOR (CENTS) | VALIDATE CATALOG PRICE
export function dollarsToMinor(price) {
    if (typeof price !== 'number' || !Number.isFinite(price) || price < 0) {
        throw new Error('Invalid catalog price');
    }

    const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(String(price));
    if (!match) {
        throw new Error('Catalog prices must have at most two decimal places');
    }

    // CONVERT DOLLARS TO MINOR (CENTS) AND VALIDATE RANGE
    const minor = Number(match[1]) * 100 + Number((match[2] || '').padEnd(2, '0'));
    if (!Number.isSafeInteger(minor) || minor > MAX_PAYMENT_MINOR) {
        throw new Error('Catalog price exceeds the supported amount');
    }

    return minor;
}
