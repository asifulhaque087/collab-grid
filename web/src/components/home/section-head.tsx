// Centered eyebrow + heading block shared by every marketing section.
export function SectionHead({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="sec-head">
      <span className="eyebrow">{eyebrow}</span>
      <h2>{title}</h2>
    </div>
  );
}
