// CANONICAL PUBLIC NUMBERS — single source of truth for the site.
// Mirror of blog/data/facts.toml and blackwell-praxis/published/facts.md.
// Run ../blog/scripts/check-facts.sh to detect drift across every surface.
export const facts = {
  downloads: '150K+',
  totalDownloads: 'Nearly 1M',
  ossProjects: '20+',
  prsMerged: '50+',
  papers: '11',
  gcfImplementations: '7',
  gcfEvals: '2,500+',
  secretManagerDls: '275K+',
  mcpAssertDls: '55,000+',
  adopterRepos: '120+',
  adopterOrgs: '60+',
  gcfDls: '580K+',
  gcfOutsideProjects: '28',
  agentLspTools: '65',
} as const;
