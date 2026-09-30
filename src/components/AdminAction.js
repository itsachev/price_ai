import ButtonLabel from './ButtonLabel';
import ProductDialog from './ProductDialog';

// One admin account action (src/app/actions/admin.js) as a small form: the
// account id, an optional on/off flag and, from the account page, `back` so
// the action lands there again instead of on the list.
export default function AdminAction({ action, id, on, back, variant, children }) {
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      {on != null && <input type="hidden" name="on" value={on ? '1' : ''} />}
      {back && <input type="hidden" name="back" value="account" />}
      <button className={variant ? `button button--${variant}` : 'button'}>
        <ButtonLabel>{children}</ButtonLabel>
      </button>
    </form>
  );
}

// The same action behind a confirm dialog: the trigger opens it, the button
// inside runs the action. `text` says what will happen; `confirm` is the
// confirm button's variant (defaults to the trigger's).
export function ConfirmAction({ label, text, closeLabel, variant, confirm = variant, ...action }) {
  return (
    <ProductDialog label={label} title={label} closeLabel={closeLabel} variant={variant}>
      <p>{text}</p>
      <div className="product-form__actions">
        <AdminAction {...action} variant={confirm}>{label}</AdminAction>
      </div>
    </ProductDialog>
  );
}
