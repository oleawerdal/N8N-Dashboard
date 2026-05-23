import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { users, settings } from "@/lib/store";
import { AccountUI } from "./AccountUI";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const session = await getSession();
  if (!session.user) redirect("/login?next=/account");
  const me = await users.findById(session.user.id);
  if (!me) redirect("/login");

  const auth = (await settings.read()).auth;
  return (
    <div className="space-y-4 sm:space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold">
          Account & Security
        </h1>
        <p className="text-muted text-sm">
          Manage how you sign in. The platform admin controls which methods
          are enabled.
        </p>
      </div>
      <AccountUI
        initial={{
          email: me.email,
          name: me.name,
          role: me.role,
          clientRole: me.clientRole ?? null,
          mfaEnabled: me.mfaEnabled,
          passkeyCount: me.passkeyCount,
          ssoProvider: me.ssoProvider,
        }}
        authPolicy={{
          passkeysEnabled: auth.passkeys.enabled,
          entraEnabled: auth.entra.enabled,
          mfaEnforced: auth.mfa.enforced,
        }}
      />
    </div>
  );
}
