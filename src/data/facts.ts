// CANONICAL PUBLIC NUMBERS — single source of truth for the site.
// Mirror of blog/data/facts.toml and blackwell-praxis/published/facts.md.
// Run ../blog/scripts/check-facts.sh to detect drift across every surface.
export const facts = {
  downloads: '150K+',
  totalDownloads: '1M+',
  ossProjects: '20+',
  prsMerged: '50+',
  papers: '11',
  gcfImplementations: '7',
  gcfEvals: '2,500+',
  secretManagerDls: '350K+',
  mcpAssertDls: '55,000+',
  adopterRepos: '120+',
  adopterOrgs: '60+',
  gcfDls: '700K+',
  gcfOutsideProjects: '28',
  agentLspTools: '65',
} as const;
