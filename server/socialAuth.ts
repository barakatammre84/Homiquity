import type { Express } from "express";
import { authStorage } from "./replit_integrations/auth/storage";
import { randomBytes } from "crypto";

interface OAuthProviderConfig {
  authUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  clientIdEnv: string;
  clientSecretEnv: string;
  scope: string;
  parseUserInfo: (data: any) => { email: string; firstName?: string; lastName?: string; profileImageUrl?: string };
}

const providers: Record<string, OAuthProviderConfig> = {
  google: {
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    userInfoUrl: "https://www.googleapis.com/oauth2/v2/userinfo",
    clientIdEnv: "GOOGLE_CLIENT_ID",
    clientSecretEnv: "GOOGLE_CLIENT_SECRET",
    scope: "openid email profile",
    parseUserInfo: (data: any) => {
      if (data.verified_email === false) return { email: "" };
      return {
        email: data.email,
        firstName: data.given_name || null,
        lastName: data.family_name || null,
        profileImageUrl: data.picture || null,
      };
    },
  },
  linkedin: {
    authUrl: "https://www.linkedin.com/oauth/v2/authorization",
    tokenUrl: "https://www.linkedin.com/oauth/v2/accessToken",
    userInfoUrl: "https://api.linkedin.com/v2/userinfo",
    clientIdEnv: "LINKEDIN_CLIENT_ID",
    clientSecretEnv: "LINKEDIN_CLIENT_SECRET",
    scope: "openid profile email",
    parseUserInfo: (data: any) => ({
      email: data.email,
      firstName: data.given_name || null,
      lastName: data.family_name || null,
      profileImageUrl: data.picture || null,
    }),
  },
  apple: {
    authUrl: "https://appleid.apple.com/auth/authorize",
    tokenUrl: "https://appleid.apple.com/auth/token",
    userInfoUrl: "",
    clientIdEnv: "APPLE_CLIENT_ID",
    clientSecretEnv: "APPLE_CLIENT_SECRET",
    scope: "name email",
    parseUserInfo: (_data: any) => ({
      email: "",
      firstName: null,
      lastName: null,
      profileImageUrl: null,
    }),
  },
};

function getCallbackUrl(req: any, provider: string): string {
  const protocol = req.headers["x-forwarded-proto"] || req.protocol;
  return `${protocol}://${req.get("host")}/api/auth/${provider}/callback`;
}

function isProviderConfigured(provider: OAuthProviderConfig): boolean {
  return !!(process.env[provider.clientIdEnv] && process.env[provider.clientSecretEnv]);
}

function decodeJwtPayload(token: string): any {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const payload = Buffer.from(parts[1], "base64url").toString("utf8");
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

export function setupSocialAuth(app: Express) {
  app.get("/api/auth/providers", (_req, res) => {
    const available: Record<string, boolean> = {};
    for (const [name, config] of Object.entries(providers)) {
      available[name] = isProviderConfigured(config);
    }
    res.json({ providers: available });
  });

  for (const [providerName, config] of Object.entries(providers)) {
    app.get(`/api/auth/${providerName}`, (req, res) => {
      if (!isProviderConfigured(config)) {
        return res.status(503).json({ error: `${providerName} login is not configured yet` });
      }

      const state = randomBytes(16).toString("hex");
      (req.session as any).oauthState = state;
      (req.session as any).oauthProvider = providerName;

      const params = new URLSearchParams({
        client_id: process.env[config.clientIdEnv]!,
        redirect_uri: getCallbackUrl(req, providerName),
        response_type: "code",
        scope: config.scope,
        state,
      });

      if (providerName === "apple") {
        params.set("response_mode", "form_post");
      }

      res.redirect(`${config.authUrl}?${params.toString()}`);
    });

    const callbackHandler = async (req: any, res: any) => {
      try {
        const oauthError = req.body?.error || req.query?.error;
        if (oauthError) {
          const desc = req.body?.error_description || req.query?.error_description || oauthError;
          console.error(`[${providerName}] OAuth provider returned error: ${desc}`);
          delete (req.session as any).oauthState;
          delete (req.session as any).oauthProvider;
          return res.redirect("/login?error=auth_failed");
        }

        const code = req.body?.code || req.query?.code;
        const state = req.body?.state || req.query?.state;
        const sessionState = (req.session as any).oauthState;
        const sessionProvider = (req.session as any).oauthProvider;

        if (!state || state !== sessionState) {
          console.error(`[${providerName}] OAuth state mismatch`);
          return res.redirect("/login?error=auth_failed");
        }

        if (sessionProvider && sessionProvider !== providerName) {
          console.error(`[${providerName}] Provider mismatch: session expected ${sessionProvider}`);
          delete (req.session as any).oauthState;
          delete (req.session as any).oauthProvider;
          return res.redirect("/login?error=auth_failed");
        }

        delete (req.session as any).oauthState;
        delete (req.session as any).oauthProvider;

        if (!code) {
          return res.redirect("/login?error=auth_failed");
        }

        const tokenParams: Record<string, string> = {
          client_id: process.env[config.clientIdEnv]!,
          client_secret: process.env[config.clientSecretEnv]!,
          code,
          redirect_uri: getCallbackUrl(req, providerName),
          grant_type: "authorization_code",
        };

        const tokenRes = await fetch(config.tokenUrl, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
          body: new URLSearchParams(tokenParams).toString(),
        });

        if (!tokenRes.ok) {
          const errText = await tokenRes.text();
          console.error(`[${providerName}] Token exchange failed:`, errText);
          return res.redirect("/login?error=auth_failed");
        }

        const tokenData = await tokenRes.json();
        const accessToken = tokenData.access_token;
        const idToken = tokenData.id_token;

        let userInfo: { email: string; firstName?: string | null; lastName?: string | null; profileImageUrl?: string | null };

        if (providerName === "apple") {
          const claims = idToken ? decodeJwtPayload(idToken) : null;
          const appleUser = req.body?.user ? (typeof req.body.user === "string" ? JSON.parse(req.body.user) : req.body.user) : null;
          userInfo = {
            email: claims?.email || "",
            firstName: appleUser?.name?.firstName || null,
            lastName: appleUser?.name?.lastName || null,
            profileImageUrl: null,
          };
        } else {
          const userRes = await fetch(config.userInfoUrl, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          if (!userRes.ok) {
            console.error(`[${providerName}] UserInfo fetch failed`);
            return res.redirect("/login?error=auth_failed");
          }
          const userData = await userRes.json();
          userInfo = config.parseUserInfo(userData);
        }

        if (!userInfo.email) {
          console.error(`[${providerName}] No email returned from provider`);
          return res.redirect("/login?error=no_email");
        }

        const email = userInfo.email.trim().toLowerCase();

        const user = await authStorage.upsertSocialUser({
          email,
          firstName: userInfo.firstName || null,
          lastName: userInfo.lastName || null,
          profileImageUrl: userInfo.profileImageUrl || null,
          authProvider: providerName,
        });

        req.login(
          {
            id: user.id,
            email: user.email || undefined,
            firstName: user.firstName || undefined,
            lastName: user.lastName || undefined,
            profileImageUrl: user.profileImageUrl || undefined,
            role: user.role,
          },
          (err: any) => {
            if (err) {
              console.error(`[${providerName}] Session login failed:`, err);
              return res.redirect("/login?error=auth_failed");
            }
            const roleRoute =
              user.role === "admin" ? "/admin" :
              ["lo", "loa", "processor", "underwriter", "closer", "broker", "lender"].includes(user.role) ? "/staff-dashboard" :
              "/dashboard";
            res.redirect(roleRoute);
          }
        );
      } catch (error) {
        console.error(`[${providerName}] OAuth callback error:`, error);
        res.redirect("/login?error=auth_failed");
      }
    };

    app.get(`/api/auth/${providerName}/callback`, callbackHandler);
    app.post(`/api/auth/${providerName}/callback`, callbackHandler);
  }
}
