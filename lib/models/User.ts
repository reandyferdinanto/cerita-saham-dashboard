import { Schema, model, models, Document } from "mongoose";

export type MembershipDuration = "3months" | "6months" | "1year";
export type MembershipStatus = "pending" | "active" | "expired" | "rejected" | "suspended";

export interface IUser extends Document {
  email: string;
  phoneHash: string; // bcrypt hash of phone number
  role: "user" | "admin" | "superadmin";
  avatarUrl?: string | null;
  name?: string | null;
  // Membership
  membershipStatus: MembershipStatus;
  membershipDuration?: MembershipDuration | null;
  membershipStartDate?: Date | null;
  membershipEndDate?: Date | null;
  membershipNote?: string | null; // admin note
  createdAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    phoneHash: { type: String, required: true },
    role: {
      type: String,
      enum: ["user", "admin", "superadmin"],
      default: "user",
    },
    avatarUrl: { type: String, default: null },
    name: { type: String, default: null },
    membershipStatus: {
      type: String,
      enum: ["pending", "active", "expired", "rejected", "suspended"],
      default: "pending",
    },
    membershipDuration: { type: String, enum: ["3months", "6months", "1year", null], default: null },
    membershipStartDate: { type: Date, default: null },
    membershipEndDate: { type: Date, default: null },
    membershipNote: { type: String, default: null },
  },
  { timestamps: true }
);

// Prevent model recompilation in dev hot reload
const User = models.User || model<IUser>("User", UserSchema);
export default User;
