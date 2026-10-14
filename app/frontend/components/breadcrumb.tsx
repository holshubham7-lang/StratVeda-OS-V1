export type Crumb = { name: string; href: string };

export function Breadcrumb({ items }: { items: Crumb[] }) {
  const lastIndex = items.length - 1;
  return (
    <nav className="breadcrumb" aria-label="Breadcrumb">
      <ol role="list">
        {items.map((crumb, index) => (
          <li key={crumb.name}>
            {index === lastIndex
              ? <span aria-current="page">{crumb.name}</span>
              : <a href={crumb.href}>{crumb.name}</a>}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function breadcrumbNode(siteUrl: string, items: Crumb[]) {
  return {
    "@type": "BreadcrumbList",
    "@id": `${siteUrl}${items[items.length - 1].href}#breadcrumbs`,
    itemListElement: items.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: `${siteUrl}${crumb.href}`,
    })),
  };
}
