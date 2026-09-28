import type React from 'react'

export function Section({ title, children }: { title: string; children: React.ReactNode }) { return <section className="section"><div className="section-title"><h2>{title}</h2></div>{children}</section> }
