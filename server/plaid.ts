import { Configuration, PlaidApi, PlaidEnvironments, Products, CountryCode } from "plaid";

const PLAID_CLIENT_ID = process.env.PLAID_CLIENT_ID;
const PLAID_SECRET = process.env.PLAID_SECRET;
const PLAID_ENV = process.env.PLAID_ENV || "sandbox";

const configuration = new Configuration({
  basePath: PlaidEnvironments[PLAID_ENV as keyof typeof PlaidEnvironments] || PlaidEnvironments.sandbox,
  baseOptions: {
    headers: {
      "PLAID-CLIENT-ID": PLAID_CLIENT_ID,
      "PLAID-SECRET": PLAID_SECRET,
    },
  },
});

export const plaidClient = new PlaidApi(configuration);

export function isPlaidConfigured(): boolean {
  return !!(PLAID_CLIENT_ID && PLAID_SECRET);
}

export type VerificationType = "employment" | "identity" | "income" | "assets";

export interface CreateLinkTokenOptions {
  userId: string;
  verificationType: VerificationType;
  webhookUrl?: string;
}

export async function createLinkToken(options: CreateLinkTokenOptions) {
  if (!isPlaidConfigured()) {
    throw new Error("Plaid is not configured. Please set PLAID_CLIENT_ID and PLAID_SECRET environment variables.");
  }

  const { userId, verificationType, webhookUrl } = options;
  const products: Products[] = [];
  
  // Map verification type to Plaid products
  switch (verificationType) {
    case "employment":
    case "income":
      // Income verification covers employment data too
      products.push(Products.Income);
      break;
    case "identity":
      products.push(Products.IdentityVerification);
      break;
    case "assets":
      products.push(Products.Assets);
      break;
  }

  const request: any = {
    user: {
      client_user_id: userId,
    },
    client_name: "MortgageAI",
    products,
    country_codes: [CountryCode.Us],
    language: "en",
  };

  if (webhookUrl) {
    request.webhook = webhookUrl;
  }

  const response = await plaidClient.linkTokenCreate(request);
  return {
    linkToken: response.data.link_token,
    expiration: response.data.expiration,
    requestId: response.data.request_id,
  };
}

export async function exchangePublicToken(publicToken: string) {
  if (!isPlaidConfigured()) {
    throw new Error("Plaid is not configured.");
  }

  const response = await plaidClient.itemPublicTokenExchange({
    public_token: publicToken,
  });

  return {
    accessToken: response.data.access_token,
    itemId: response.data.item_id,
  };
}

export async function getIdentityData(accessToken: string) {
  if (!isPlaidConfigured()) {
    throw new Error("Plaid is not configured.");
  }

  const response = await plaidClient.identityGet({
    access_token: accessToken,
  });

  // Extract identity information from all accounts
  const identityData: {
    names: string[];
    addresses: { street: string; city: string; region: string; postalCode: string; country: string; primary: boolean }[];
    emails: string[];
    phoneNumbers: string[];
  } = {
    names: [],
    addresses: [],
    emails: [],
    phoneNumbers: [],
  };

  for (const account of response.data.accounts) {
    if (account.owners) {
      for (const owner of account.owners) {
        if (owner.names) {
          identityData.names.push(...owner.names);
        }
        if (owner.addresses) {
          for (const addr of owner.addresses) {
            identityData.addresses.push({
              street: addr.data.street || "",
              city: addr.data.city || "",
              region: addr.data.region || "",
              postalCode: addr.data.postal_code || "",
              country: addr.data.country || "",
              primary: addr.primary || false,
            });
          }
        }
        if (owner.emails) {
          for (const email of owner.emails) {
            if (email.data) identityData.emails.push(email.data);
          }
        }
        if (owner.phone_numbers) {
          for (const phone of owner.phone_numbers) {
            if (phone.data) identityData.phoneNumbers.push(phone.data);
          }
        }
      }
    }
  }

  // Deduplicate
  identityData.names = Array.from(new Set(identityData.names));
  identityData.emails = Array.from(new Set(identityData.emails));
  identityData.phoneNumbers = Array.from(new Set(identityData.phoneNumbers));

  return {
    identityData,
    verified: identityData.names.length > 0,
    rawResponse: response.data,
  };
}

export async function removeItem(accessToken: string) {
  if (!isPlaidConfigured()) {
    throw new Error("Plaid is not configured.");
  }

  await plaidClient.itemRemove({
    access_token: accessToken,
  });
}

// Get item details
export async function getItem(accessToken: string) {
  if (!isPlaidConfigured()) {
    throw new Error("Plaid is not configured.");
  }

  const response = await plaidClient.itemGet({
    access_token: accessToken,
  });

  return response.data;
}
