import { randomUUID } from "crypto";
import { connectDB } from "@/lib/db";
import { queryPostgres } from "@/lib/postgres";
import User, { type MembershipDuration, type MembershipStatus } from "@/lib/models/User";
import { runWithDatabasePreference } from "@/lib/data/provider";
import { type PlainUser } from "@/lib/data/shared";

function toPlainUser(doc: {
  _id?: unknown;
  id?: unknown;
  email: string;
  phoneHash: string;
  role: "user" | "admin" | "superadmin";
  avatarUrl?: string | null;
  name?: string | null;
  membershipStatus: MembershipStatus;
  membershipDuration?: MembershipDuration | null;
  membershipStartDate?: Date | null;
  membershipEndDate?: Date | null;
  membershipNote?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}): PlainUser {
  return {
    _id: String(doc._id ?? doc.id),
    email: doc.email,
    phoneHash: doc.phoneHash,
    role: doc.role,
    avatarUrl: doc.avatarUrl ?? null,
    name: doc.name ?? null,
    membershipStatus: doc.membershipStatus,
    membershipDuration: doc.membershipDuration ?? null,
    membershipStartDate: doc.membershipStartDate ?? null,
    membershipEndDate: doc.membershipEndDate ?? null,
    membershipNote: doc.membershipNote ?? null,
    createdAt: doc.createdAt ?? new Date(),
    updatedAt: doc.updatedAt ?? doc.createdAt ?? new Date(),
  };
}

type PgUserRow = {
  id: string;
  email: string;
  phone_hash: string;
  role: PlainUser["role"];
  avatar_url: string | null;
  name: string | null;
  membership_status: MembershipStatus;
  membership_duration: MembershipDuration | null;
  membership_start_date: Date | null;
  membership_end_date: Date | null;
  membership_note: string | null;
  created_at: Date;
  updated_at: Date;
};

function fromPg(row: PgUserRow) {
  return toPlainUser({
    id: row.id,
    email: row.email,
    phoneHash: row.phone_hash,
    role: row.role,
    avatarUrl: row.avatar_url,
    name: row.name,
    membershipStatus: row.membership_status,
    membershipDuration: row.membership_duration,
    membershipStartDate: row.membership_start_date,
    membershipEndDate: row.membership_end_date,
    membershipNote: row.membership_note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

export async function findUserByEmail(email: string) {
  return runWithDatabasePreference(
    "findUserByEmail",
    async () => {
      const result = await queryPostgres<PgUserRow>(
        `select id, email, phone_hash, role, avatar_url, name, membership_status, membership_duration,
                membership_start_date, membership_end_date, membership_note, created_at, updated_at
         from users where email = $1 limit 1`,
        [email.toLowerCase()]
      );
      return result.rows[0] ? fromPg(result.rows[0]) : null;
    },
    async () => {
      await connectDB();
      const user = await User.findOne({ email: email.toLowerCase() }).lean();
      return user ? toPlainUser(user) : null;
    }
  );
}

export async function findUserById(id: string) {
  return runWithDatabasePreference(
    "findUserById",
    async () => {
      const result = await queryPostgres<PgUserRow>(
        `select id, email, phone_hash, role, avatar_url, name, membership_status, membership_duration,
                membership_start_date, membership_end_date, membership_note, created_at, updated_at
         from users where id = $1 limit 1`,
        [id]
      );
      return result.rows[0] ? fromPg(result.rows[0]) : null;
    },
    async () => {
      await connectDB();
      const user = await User.findById(id).lean();
      return user ? toPlainUser(user) : null;
    }
  );
}

export async function createUserRecord(args: {
  email: string;
  phoneHash: string;
  name?: string | null;
  role?: PlainUser["role"];
  membershipStatus?: MembershipStatus;
  membershipDuration?: MembershipDuration | null;
}) {
  return runWithDatabasePreference(
    "createUserRecord",
    async () => {
      const result = await queryPostgres<PgUserRow>(
        `insert into users (
          id, email, phone_hash, role, avatar_url, name, membership_status, membership_duration
        )
        values ($1,$2,$3,$4,null,$5,$6,$7)
        returning id, email, phone_hash, role, avatar_url, name, membership_status, membership_duration,
                  membership_start_date, membership_end_date, membership_note, created_at, updated_at`,
        [
          randomUUID(),
          args.email.toLowerCase(),
          args.phoneHash,
          args.role ?? "user",
          args.name ?? null,
          args.membershipStatus ?? "pending",
          args.membershipDuration ?? null,
        ]
      );
      return fromPg(result.rows[0]);
    },
    async () => {
      await connectDB();
      const user = await User.create({
        email: args.email.toLowerCase(),
        phoneHash: args.phoneHash,
        name: args.name ?? null,
        role: args.role ?? "user",
        membershipStatus: args.membershipStatus ?? "pending",
        membershipDuration: args.membershipDuration ?? null,
      });
      return toPlainUser(user.toObject());
    }
  );
}

export async function updateUserMembershipStatus(userId: string, membershipStatus: MembershipStatus) {
  return runWithDatabasePreference(
    "updateUserMembershipStatus",
    async () => {
      await queryPostgres(`update users set membership_status = $2, updated_at = now() where id = $1`, [userId, membershipStatus]);
    },
    async () => {
      await connectDB();
      await User.findByIdAndUpdate(userId, { membershipStatus });
    }
  );
}

export async function updateUserAvatar(userId: string, avatarUrl: string) {
  return runWithDatabasePreference(
    "updateUserAvatar",
    async () => {
      await queryPostgres(`update users set avatar_url = $2, updated_at = now() where id = $1`, [userId, avatarUrl]);
    },
    async () => {
      await connectDB();
      await User.findByIdAndUpdate(userId, { avatarUrl });
    }
  );
}

export async function expireUsersWithPastMembership() {
  return runWithDatabasePreference(
    "expireUsersWithPastMembership",
    async () => {
      await queryPostgres(
        `update users
         set membership_status = 'expired', updated_at = now()
         where membership_status = 'active' and membership_end_date is not null and membership_end_date < now()`
      );
    },
    async () => {
      await connectDB();
      await User.updateMany(
        { membershipStatus: "active", membershipEndDate: { $lt: new Date() } },
        { $set: { membershipStatus: "expired" } }
      );
    }
  );
}

export async function listUsersForAdmin(options?: { excludeSuperadmin?: boolean }) {
  return runWithDatabasePreference(
    "listUsersForAdmin",
    async () => {
      const where = options?.excludeSuperadmin ? "where role <> 'superadmin'" : "";
      const result = await queryPostgres<Omit<PgUserRow, "phone_hash" | "updated_at"> & { avatar_url: string | null }>(
        `select id, email, role, avatar_url, name, membership_status, membership_duration,
                membership_start_date, membership_end_date, membership_note, created_at
         from users ${where}
         order by created_at desc`
      );
      return result.rows.map((row) => ({
        _id: row.id,
        email: row.email,
        role: row.role,
        avatarUrl: row.avatar_url,
        name: row.name,
        membershipStatus: row.membership_status,
        membershipDuration: row.membership_duration,
        membershipStartDate: row.membership_start_date,
        membershipEndDate: row.membership_end_date,
        membershipNote: row.membership_note,
        createdAt: row.created_at,
      }));
    },
    async () => {
      await connectDB();
      const query = options?.excludeSuperadmin ? { role: { $ne: "superadmin" } } : {};
      const users = await User.find(query, { phoneHash: 0 }).sort({ createdAt: -1 }).lean();
      return users.map((user) => ({ ...user, _id: String(user._id) }));
    }
  );
}

export async function patchUserAdminFields(
  userId: string,
  patch: Partial<{
    role: PlainUser["role"];
    membershipStatus: MembershipStatus;
    membershipStartDate: Date | null;
    membershipEndDate: Date | null;
    membershipNote: string | null;
  }>
) {
  return runWithDatabasePreference(
    "patchUserAdminFields",
    async () => {
      const existing = await findUserById(userId);
      if (!existing) return null;
      const result = await queryPostgres<PgUserRow>(
        `update users
         set role = $2,
             membership_status = $3,
             membership_start_date = $4,
             membership_end_date = $5,
             membership_note = $6,
             updated_at = now()
         where id = $1
         returning id, email, phone_hash, role, avatar_url, name, membership_status, membership_duration,
                   membership_start_date, membership_end_date, membership_note, created_at, updated_at`,
        [
          userId,
          patch.role ?? existing.role,
          patch.membershipStatus ?? existing.membershipStatus,
          patch.membershipStartDate ?? existing.membershipStartDate,
          patch.membershipEndDate ?? existing.membershipEndDate,
          patch.membershipNote ?? existing.membershipNote,
        ]
      );
      return result.rows[0] ? fromPg(result.rows[0]) : null;
    },
    async () => {
      await connectDB();
      const updated = await User.findByIdAndUpdate(userId, patch, { new: true }).lean();
      return updated ? toPlainUser(updated) : null;
    }
  );
}

export async function deleteUserRecord(userId: string) {
  return runWithDatabasePreference(
    "deleteUserRecord",
    async () => {
      await queryPostgres(`delete from users where id = $1`, [userId]);
    },
    async () => {
      await connectDB();
      await User.findByIdAndDelete(userId);
    }
  );
}
