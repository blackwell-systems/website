import { getPermalink } from './utils/permalinks';

export const headerData = {
  links: [
    { text: 'Projects', href: '/#projects' },
    { text: 'Services', href: '/services' },
    { text: 'Contributions', href: '/#contributions' },
  ],
  actions: [{ text: 'Book a Call', href: 'https://cal.com/blackwell-systems' }],
};

export const footerData = {
  links: [
    {
      title: 'Projects',
      links: [
        { text: 'GCF', href: 'https://gcformat.com' },
        { text: 'agent-lsp', href: 'https://github.com/blackwell-systems/agent-lsp' },
        { text: 'mcp-assert', href: 'https://github.com/blackwell-systems/mcp-assert' },
        { text: 'knowing', href: 'https://github.com/blackwell-systems/knowing' },
        { text: 'GCF Proxy', href: 'https://github.com/blackwell-systems/gcf-proxy' },
      ],
    },
    {
      title: 'Resources',
      links: [
        { text: 'Benchmarks', href: 'https://gcformat.com/guide/benchmarks.html' },
        { text: 'Playground', href: 'https://gcformat.com/playground.html' },
        { text: 'Blog', href: 'https://blog.blackwell-systems.com' },
        { text: 'Open Source', href: 'https://blog.blackwell-systems.com/oss' },
      ],
    },
    {
      title: 'Company',
      links: [
        { text: 'GitHub', href: 'https://github.com/blackwell-systems' },
        { text: 'LinkedIn', href: 'https://www.linkedin.com/in/daynablackwell/' },
        { text: 'Services', href: '/services' },
      ],
    },
  ],
  secondaryLinks: [],
  socialLinks: [
    { ariaLabel: 'GitHub', icon: 'tabler:brand-github', href: 'https://github.com/blackwell-systems' },
    { ariaLabel: 'LinkedIn', icon: 'tabler:brand-linkedin', href: 'https://www.linkedin.com/in/daynablackwell/' },
  ],
  footNote: `
    &copy; 2026 Dayna Blackwell / Blackwell Systems. All rights reserved.
  `,
};
