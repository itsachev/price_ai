'use client';

import { useActionState } from 'react';

const fill = (text, values) => text.replace(/\{(\w+)\}/g, (_, k) => values[k]);

function Message({ kind, children }) {
  return (
    <div className="form-message" role={kind === 'error' ? 'alert' : 'status'} data-kind={kind}>
      {children}
    </div>
  );
}

// Add or edit one product. `t` is dict.products (dictionaries are server-only).
export function ProductForm({ t, action, product }) {
  const [state, formAction, pending] = useActionState(action, null);
  const values = state?.values ?? product ?? {};
  const field = (name, props = {}) => (
    <label className="field" data-field={name}>
      <span>
        {t.fields[name]}
        {t.fieldHints[name] && <small>{t.fieldHints[name]}</small>}
      </span>
      <input name={name} defaultValue={values[name] ?? ''} autoComplete="off" {...props} />
    </label>
  );

  return (
    <form action={formAction} className="product-form">
      {product && <input type="hidden" name="id" value={product.id} />}
      <div className="product-form__fields">
        {field('name', { required: true, maxLength: 200 })}
        {field('brand', { maxLength: 100 })}
        {field('size', { maxLength: 50 })}
        {field('price', { required: true, inputMode: 'decimal' })}
        {field('cost', { inputMode: 'decimal' })}
        {field('sku', { maxLength: 64 })}
      </div>
      {state?.error && <Message kind="error">{t.errors[state.error] ?? t.errors.unknown}</Message>}
      {state?.notice && <Message kind="notice">{t.notices[state.notice]}</Message>}
      <div className="product-form__actions">
        <button className="button button--primary" disabled={pending} aria-busy={pending}>
          {product ? t.save : t.add}
        </button>
      </div>
    </form>
  );
}

// Delete one product, after the browser's confirm().
export function DeleteForm({ t, action, id }) {
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <button className="button button--danger" onClick={(e) => confirm(t.confirmDelete) || e.preventDefault()}>
        {t.delete}
      </button>
    </form>
  );
}

// CSV upload with a summary of what was added, updated and skipped.
export function ImportForm({ t, action }) {
  const [state, formAction, pending] = useActionState(action, null);
  const rowErrors = state?.errors?.length > 0 && (
    <ul className="form-message__rows">
      {state.errors.map(({ row, error }) => (
        <li key={row}>{fill(t.import.rowError, { row, error: t.errors[error] })}</li>
      ))}
    </ul>
  );

  return (
    <form action={formAction} className="product-form">
      <label className="field">
        <span>{t.import.file}</span>
        <input type="file" name="file" accept=".csv,text/csv" required />
      </label>
      {state?.error && (
        <Message kind="error">
          {state.error === 'columns'
            ? fill(t.errors.columns, { cols: state.missing.map((c) => t.fields[c]).join(', ') })
            : t.errors[state.error] ?? t.errors.unknown}
          {rowErrors}
        </Message>
      )}
      {state?.notice && (
        <Message kind="notice">
          {fill(t.import.result, state)}
          {state.skipped > 0 && <> {fill(t.import.skipped, state)}</>}
          {rowErrors}
        </Message>
      )}
      <div className="product-form__actions">
        <button className="button button--primary" disabled={pending} aria-busy={pending}>
          {pending ? t.import.working : t.import.submit}
        </button>
      </div>
    </form>
  );
}
