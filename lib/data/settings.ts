import { connectDB } from "@/lib/db";
import { queryPostgres } from "@/lib/postgres";
import SiteSettings, { type IPaymentMethod } from "@/lib/models/SiteSettings";
import { runWithDatabasePreference } from "@/lib/data/provider";
import {
  DEFAULT_INVESTOR_TOOLS,
  DEFAULT_SITE_SETTINGS,
  type PlainSiteSettings,
} from "@/lib/data/shared";

function toPlainSiteSettings(doc: {
  _id?: unknown;
  id?: unknown;
  membershipPrices: PlainSiteSettings["membershipPrices"];
  paymentMethods: IPaymentMethod[];
  enabledInvestorTools?: string[];
  updatedAt?: Date;
}) {
  return {
    _id: String(doc._id ?? doc.id ?? "default"),
    membershipPrices: doc.membershipPrices,
    paymentMethods: doc.paymentMethods,
    enabledInvestorTools:
      Array.isArray(doc.enabledInvestorTools) && doc.enabledInvestorTools.length > 0
        ? doc.enabledInvestorTools
        : DEFAULT_INVESTOR_TOOLS,
    updatedAt: doc.updatedAt ?? new Date(),
  };
}

type PgSettingsRow = {
  id: string;
  membership_prices: PlainSiteSettings["membershipPrices"];
  payment_methods: IPaymentMethod[];
  enabled_investor_tools: string[];
  updated_at: Date;
};

function fromPg(row: PgSettingsRow) {
  return toPlainSiteSettings({
    id: row.id,
    membershipPrices: row.membership_prices,
    paymentMethods: row.payment_methods,
    enabledInvestorTools: row.enabled_investor_tools,
    updatedAt: row.updated_at,
  });
}

export async function getSiteSettingsRecord() {
  return runWithDatabasePreference(
    "getSiteSettingsRecord",
    async () => {
      await queryPostgres(
        `insert into site_settings (id, membership_prices, payment_methods, enabled_investor_tools)
         values ('default', $1::jsonb, $2::jsonb, $3::text[])
         on conflict (id) do nothing`,
        [
          JSON.stringify(DEFAULT_SITE_SETTINGS.membershipPrices),
          JSON.stringify(DEFAULT_SITE_SETTINGS.paymentMethods),
          DEFAULT_SITE_SETTINGS.enabledInvestorTools,
        ]
      );
      const result = await queryPostgres<PgSettingsRow>(
        `select id, membership_prices, payment_methods, enabled_investor_tools, updated_at
         from site_settings where id = 'default' limit 1`
      );
      return fromPg(result.rows[0]);
    },
    async () => {
      await connectDB();
      let settings = await SiteSettings.findOne({});
      if (!settings) {
        settings = await SiteSettings.create(DEFAULT_SITE_SETTINGS);
      }
      if (!Array.isArray(settings.enabledInvestorTools) || settings.enabledInvestorTools.length === 0) {
        settings.enabledInvestorTools = DEFAULT_INVESTOR_TOOLS;
        await settings.save();
      }
      return toPlainSiteSettings(settings.toObject());
    }
  );
}

export async function updateSiteSettingsRecord(input: {
  membershipPrices: PlainSiteSettings["membershipPrices"];
  paymentMethods: IPaymentMethod[];
  enabledInvestorTools: string[];
}) {
  return runWithDatabasePreference(
    "updateSiteSettingsRecord",
    async () => {
      const result = await queryPostgres<PgSettingsRow>(
        `insert into site_settings (id, membership_prices, payment_methods, enabled_investor_tools, updated_at)
         values ('default', $1::jsonb, $2::jsonb, $3::text[], now())
         on conflict (id) do update
         set membership_prices = excluded.membership_prices,
             payment_methods = excluded.payment_methods,
             enabled_investor_tools = excluded.enabled_investor_tools,
             updated_at = now()
         returning id, membership_prices, payment_methods, enabled_investor_tools, updated_at`,
        [
          JSON.stringify(input.membershipPrices),
          JSON.stringify(input.paymentMethods),
          input.enabledInvestorTools.length > 0 ? input.enabledInvestorTools : DEFAULT_INVESTOR_TOOLS,
        ]
      );
      return fromPg(result.rows[0]);
    },
    async () => {
      await connectDB();
      const existingSettings = await SiteSettings.findOne({});
      const settings = await SiteSettings.findOneAndUpdate(
        {},
        {
          $set: {
            membershipPrices: input.membershipPrices,
            paymentMethods: input.paymentMethods,
            enabledInvestorTools:
              input.enabledInvestorTools.length > 0
                ? input.enabledInvestorTools
                : existingSettings?.enabledInvestorTools?.length
                  ? existingSettings.enabledInvestorTools
                  : DEFAULT_INVESTOR_TOOLS,
          },
        },
        { upsert: true, new: true }
      );
      return toPlainSiteSettings(settings.toObject());
    }
  );
}
