import Image from 'next/image';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

interface Crumb {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  crumbs?: Crumb[];
}

function MetamorphLogo() {
  return (
    <Link href="/" className="flex items-center gap-2.5 shrink-0 group cursor-pointer">
      <Image
        src="/logo.svg"
        alt=""
        width={20}
        height={20}
        className="shrink-0 transition-transform group-hover:scale-105"
        priority
      />
      <span className="font-semibold text-sm tracking-tight uppercase text-foreground group-hover:underline underline-offset-4 transition-colors">
        Metamorph
      </span>
    </Link>
  );
}

export function PageHeader({ crumbs = [] }: PageHeaderProps) {
  return (
    <header className="border-b border-border/60 bg-card/80 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-4xl mx-auto px-6 h-14 flex items-center">
        <div className="flex items-center gap-1">
          <MetamorphLogo />
          {crumbs.length > 0 && (
            <nav className="flex items-center" aria-label="Breadcrumb">
              {crumbs.map((crumb, i) => {
                const isLast = i === crumbs.length - 1;
                return (
                  <span key={crumb.label + i} className="flex items-center">
                    <ChevronRight className="size-4 text-muted-foreground/40 mx-1" />
                    {isLast || !crumb.href ? (
                      <span className="text-sm text-foreground font-medium">
                        {crumb.label}
                      </span>
                    ) : (
                      <Link
                        href={crumb.href}
                        className="text-sm text-muted-foreground hover:text-foreground hover:underline underline-offset-4 transition-colors cursor-pointer"
                      >
                        {crumb.label}
                      </Link>
                    )}
                  </span>
                );
              })}
            </nav>
          )}
        </div>
      </div>
    </header>
  );
}
