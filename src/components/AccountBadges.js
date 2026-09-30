import { isAdmin, isBanned } from '@/lib/admin';

// You / Admin / Banned / Unconfirmed badges for an account (admin pages).
// `t` is dict.admin.users.
export default function AccountBadges({ user, self, t }) {
  return (
    <span className="admin__badges">
      {self && <span className="badge" data-status="admin">{t.you}</span>}
      {isAdmin(user) && <span className="badge" data-status="admin">{t.admin}</span>}
      {isBanned(user) && <span className="badge" data-status="at-risk">{t.banned}</span>}
      {!user.email_confirmed_at && <span className="badge" data-status="opportunity">{t.unconfirmed}</span>}
    </span>
  );
}
