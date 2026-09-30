// Lists show 10 rows per page, the page number in a search param.
export const PAGE_SIZE = 10;

// The page from a search param, clamped to 1..pages; `from`/`to` slice the
// rows (or feed .range(from, to - 1)). Pass total = Infinity when the total
// only comes back with the rows (a count query), then clamp with `pages`.
export function paginate(value, total, size = PAGE_SIZE) {
  const pages = Math.max(1, Math.ceil(total / size));
  const page = Math.min(pages, Math.max(1, Number.parseInt(value, 10) || 1));
  return { page, pages, from: (page - 1) * size, to: page * size };
}

// Links to the pages of one list, keeping the rest of the query (so two lists
// on a page page independently) but dropping a one-off ?notice.
export function pageHref(path, params, key) {
  return (page) => {
    const query = new URLSearchParams(
      Object.entries(params).filter(([k, v]) => k !== key && k !== 'notice' && typeof v === 'string'),
    );
    if (page > 1) query.set(key, page);
    const s = query.toString();
    return s ? `${path}?${s}` : path;
  };
}
