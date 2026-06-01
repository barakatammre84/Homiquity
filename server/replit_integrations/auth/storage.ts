import { users, type User } from "@shared/schema";
import { db } from "../../db";
import { eq } from "drizzle-orm";

export interface IAuthStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  upsertUser(userData: { id: string; email?: string | null; firstName?: string | null; lastName?: string | null; profileImageUrl?: string | null }): Promise<User>;
  createUserWithPassword(userData: { email: string; passwordHash: string; firstName?: string | null; lastName?: string | null }): Promise<User>;
  upsertSocialUser(userData: { email: string; firstName?: string | null; lastName?: string | null; profileImageUrl?: string | null; authProvider: string }): Promise<User>;
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
}

export const authStorage = new AuthStorage();
