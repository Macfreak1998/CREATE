import type { PoolClient } from "pg";
import { query, withTransaction } from "../../db/client.js";
import { generatePassword, hashPassword } from "../../lib/password.js";
import {
  notifyCompanyCredentials,
  notifyCompanyStatusChange,
} from "../../lib/notifications.js";
import { persistCompanyReviewSnapshot } from "../companies/repository.js";
import type { CompanyStatus } from "@b2b/shared";

export async function handleCompanyStatusTransition(args: {
  companyId: string;
  previousStatus: CompanyStatus;
  newStatus: CompanyStatus;
  companyName: string;
  contactEmail: string;
  client?: PoolClient;
}): Promise<void> {
  const { companyId, previousStatus, newStatus, companyName, contactEmail } =
    args;

  if (previousStatus === newStatus) return;

  if (newStatus === "approved") {
    const runApproval = async (client: PoolClient) => {
      await persistCompanyReviewSnapshot(client, companyId);
    };
    if (args.client) {
      await runApproval(args.client);
    } else {
      await withTransaction(runApproval);
    }
  }

  if (newStatus !== "approved" && newStatus !== "suspended") return;

  if (previousStatus === "draft" && newStatus === "approved") {
    const userResult = await query<{ email: string }>(
      `SELECT email FROM users WHERE company_id = $1`,
      [companyId]
    );
    const loginEmail = userResult.rows[0]?.email;
    if (!loginEmail) return;

    const plainPassword = generatePassword(16);
    const passwordHash = await hashPassword(plainPassword);
    await query(
      `UPDATE users
          SET password_hash = $2,
              token_version = token_version + 1
        WHERE company_id = $1`,
      [companyId, passwordHash]
    );

    void notifyCompanyCredentials({
      companyName,
      loginEmail,
      password: plainPassword,
    });
    return;
  }

  if (newStatus === "approved" || newStatus === "suspended") {
    void notifyCompanyStatusChange({
      companyEmail: contactEmail,
      companyName,
      status: newStatus,
    });
  }
}
