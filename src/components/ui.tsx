import type { ReactNode } from 'react'

export function PageHead({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) {
  return (
    <header className="mx-auto max-w-6xl px-4 pt-10 pb-8 md:pt-16 md:pb-10">
      <p className="font-wide text-[11px] tracking-[0.22em] text-teal">{eyebrow}</p>
      <h1 className="mt-3 text-[34px] leading-[1.15] font-extrabold tracking-[-0.02em] md:text-[52px]">{title}</h1>
      {children && <div className="mt-4 max-w-2xl text-[17px] leading-relaxed text-muted">{children}</div>}
    </header>
  )
}

export function Section({ title, kicker, children, id }: { title: string; kicker?: string; children: ReactNode; id?: string }) {
  return (
    <section id={id} className="mx-auto max-w-6xl px-4 py-8 md:py-10">
      {kicker && <p className="font-wide text-[10px] tracking-[0.22em] text-muted">{kicker}</p>}
      <h2 className="mt-1 text-[24px] font-extrabold tracking-[-0.01em] md:text-[30px]">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-[24px] border border-line/80 bg-card p-5 md:p-6 ${className}`}>{children}</div>
}

/** 라켓 프레임을 닮은 실버 띠 + 틸 포인트 */
export function FrameStripe({ className = '' }: { className?: string }) {
  return (
    <div className={`brushed relative h-2 overflow-hidden rounded-full ${className}`} aria-hidden="true">
      <div className="absolute inset-y-0 left-[18%] w-[22%] bg-teal" />
      <div className="absolute inset-y-0 right-0 w-[12%] bg-ink" />
    </div>
  )
}
