// Rolling button label (see button.css): the text rolls up on hover and a copy
// rolls in from below. Pass `hover` to roll in different text; it is hidden
// from screen readers, so the visible label stays the accessible name.
export default function ButtonLabel({ children, hover = children }) {
  return (
    <span className="button__label">
      <span data-roll={hover}>{children}</span>
    </span>
  );
}
