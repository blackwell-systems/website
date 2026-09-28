// CANONICAL PUBLIC NUMBERS — single source of truth for the site.
// Mirror of blog/data/facts.toml and blackwell-praxis/published/facts.md.
// Run ../blog/scripts/check-facts.sh to detect drift across every surface.
export const facts = {
  downloads: '150K+',
  ossProjects: '20+',
  prsMerged: '40+',
  papers: '9',
  gcfImplementations: '7',
  gcfEvals: '2,500+',
  secretManagerDls: '50K+',
  mcpAssertDls: '28,000+',
  agentLspTools: '65',
} as const;
