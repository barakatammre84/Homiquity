import { users, authTokens, type User, type AuthTokenType } from "@shared/schema";
import { db } from "../../db";
import { and, eq, gt, isNull } from "drizzle-orm";

export interface IAuthStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  upsertUser(userData: { id: string; email?: string | null; firstName?: string | null; lastName?: string | null; profileImageUrl?: string | null }): Promise<User>;
  createUserWithPassword(userData: { email: string; passwordHash: string; firstName?: string | null; lastName?: string | null }): Promise<User>;
  upsertSocialUser(userData: { email: string; firstName?: string | null; lastName?: string | null; profileImageUrl?: string | null; authProvider: string }): Promise<User>;
  setLockoutState(userId: string, state: { failedLoginAttempts: number; lockoutUntil: Date | null }): Promise<void>;
  // Password + email-verification token lifecycle.
  createAuthToken(input: { userId: string; type: AuthTokenType; tokenHash: string; expiresAt: Date }): Promise<void>;
  invalidateAuthTokens(userId: string, type: AuthTokenType): Promise<void>;
  consumeAuthToken(tokenHash: string, type: AuthTokenType): Promise<{ userId: string } | null>;
  setPassword(userId: string, passwordHash: string): Promise<void>;
  markEmailVerified(userId: string): Promise<void>;
}

class AuthStorage implements IAuthStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async upsertUser(userData: { id: string; email?: string | null; firstName?: string | null; lastName?: string | null; profileImageUrl?: string | null }): Promise<User> {
    const [user] = await db
      .insert(users)
      .values({
        id: userData.id,
        email: userData.email ?? null,
        firstName: userData.firstName ?? null,
        lastName: userData.lastName ?? null,
        profileImageUrl: userData.profileImageUrl ?? null,
        role: "aspiring_owner",
      })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          email: userData.email ?? undefined,
          firstName: userData.firstName ?? undefined,
          lastName: userData.lastName ?? undefined,
          profileImageUrl: userData.profileImageUrl ?? undefined,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async createUserWithPassword(userData: { email: string; passwordHash: string; firstName?: string | null; lastName?: string | null }): Promise<User> {
    const [user] = await db
      .insert(users)
      .values({
        email: userData.email,
        passwordHash: userData.passwordHash,
        authProvider: "email",
        firstName: userData.firstName ?? null,
        lastName: userData.lastName ?? null,
        role: "aspiring_owner",
      })
      .returning();
    return user;
  }

  async upsertSocialUser(userData: { email: string; firstName?: string | null; lastName?: string | null; profileImageUrl?: string | null; authProvider: string }): Promise<User> {
    const [user] = await db
      .insert(users)
      .values({
        email: userData.email,
        authProvider: userData.authProvider,
        firstName: userData.firstName ?? null,
        lastName: userData.lastName ?? null,
        profileImageUrl: userData.profileImageUrl ?? null,
        role: "aspiring_owner",
        // A federated provider has already proven ownership of the email.
        emailVerifiedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: users.email,
        set: {
          firstName: userData.firstName ?? undefined,
          lastName: userData.lastName ?? undefined,
          profileImageUrl: userData.profileImageUrl ?? undefined,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async setLockoutState(userId: string, state: { failedLoginAttempts: number; lockoutUntil: Date | null }): Promise<void> {
    await db
      .update(users)
      .set({
        failedLoginAttempts: state.failedLoginAttempts,
        lockoutUntil: state.lockoutUntil,
      })
      .where(eq(users.id, userId));
  }

  async createAuthToken(input: { userId: string; type: AuthTokenType; tokenHash: string; expiresAt: Date }): Promise<void> {
    await db.insert(authTokens).values({
      userId: input.userId,
      type: input.type,
      tokenHash: input.tokenHash,
      expiresAt: input.expiresAt,
    });
  }

  // Retire any outstanding tokens of a type for this user, so issuing a fresh
  // one (e.g. a second password-reset request) invalidates the earlier link.
  async invalidateAuthTokens(userId: string, type: AuthTokenType): Promise<void> {
    await db
      .update(authTokens)
      .set({ usedAt: new Date() })
      .where(
        and(
          eq(authTokens.userId, userId),
          eq(authTokens.type, type),
          isNull(authTokens.usedAt),
        ),
      );
  }

  // Atomically redeem a token: the UPDATE only matches a row that is unused and
  // unexpired, so a replayed link (usedAt already set) returns nothing. The
  // WHERE also re-checks the hash+type+expiry, making the read-and-consume a
  // single statement with no TOCTOU window.
  async consumeAuthToken(tokenHash: string, type: AuthTokenType): Promise<{ userId: string } | null> {
    const [row] = await db
      .update(authTokens)
      .set({ usedAt: new Date() })
      .where(
        and(
          eq(authTokens.tokenHash, tokenHash),
          eq(authTokens.type, type),
          isNull(authTokens.usedAt),
          gt(authTokens.expiresAt, new Date()),
        ),
      )
      .returning({ userId: authTokens.userId });
    return row ? { userId: row.userId } : null;
  }

  async setPassword(userId: string, passwordHash: string): Promise<void> {
    // Clearing lockout on a successful reset lets a locked-out user back in —
    // exactly the recovery path the reset flow exists to provide.
    await db
      .update(users)
      .set({ passwordHash, failedLoginAttempts: 0, lockoutUntil: null })
      .where(eq(users.id, userId));
  }

  async markEmailVerified(userId: string): Promise<void> {
    await db
      .update(users)
      .set({ emailVerifiedAt: new Date() })
      .where(eq(users.id, userId));
  }
}

export const authStorage = new AuthStorage();
