import React from 'react';
import { Section } from './Section';
import { Link } from 'lucide-react';

interface ResearchLink {
  id: number;
  title: string;
  url: string;
  content: string;
}

interface ResearchCategory {
  category: string;
  links: ResearchLink[];
}

const researchData: ResearchCategory[] = [
    {
        category: "Market Size & Growth Analysis",
        links: [
            { id: 1, title: "Business Productivity Software Market Size & Share Analysis", url: "https://www.mordorintelligence.com/industry-reports/global-business-productivity-software-market", content: "Market reached $98.25 billion in 2025, projected $183.23 billion by 2030 at 13.3% CAGR" },
            { id: 2, title: "Personal Knowledge Management (PKM)", url: "https://lab.abilian.com/Business/Personal%20Knowledge%20Management/Personal%20Knowledge%20Management%20(PKM)/", content: "Overview of PKM concepts, tools, and market trends" },
            { id: 3, title: "Privacy Enhancing Technology Market Size", url: "https://www.futuremarketinsights.com/reports/privacy-enhancing-technology-market", content: "Privacy tech market analysis, growth drivers, regulatory impact" },
            { id: 4, title: "Global Business Productivity Software Market 2025-2029", url: "https://www.giiresearch.com/report/infi1626445-global-business-productivity-software-market.html", content: "Detailed market forecasts, competitive landscape, technology trends" },
            { id: 5, title: "Personal Knowledge Management - Goals & Methods", url: "https://www.glukhov.org/post/2025/07/personal-knowledge-management/", content: "PKM methodologies, tool comparisons, implementation strategies" },
            { id: 6, title: "Privacy Management Software Market Growth Trends", url: "https://www.gminsights.com/industry-analysis/privacy-management-software-market", content: "Market size, growth projections, regulatory compliance drivers" },
            { id: 7, title: "Productivity Management Software Market Size", url: "https://www.precedenceresearch.com/productivity-management-software-market", content: "Market valued at $81.20 billion in 2025, projected $264.48 billion by 2034" },
            { id: 8, title: "Popular PKM Tool Recommendations", url: "https://affine.pro/blog/power-personal-knowledge-management-pkm-tool-recommendations", content: "PKM tool reviews, feature comparisons, user recommendations" },
            { id: 9, title: "Data Privacy Software Market Size & Share", url: "https://www.fortunebusinessinsights.com/data-privacy-software-market-105420", content: "Privacy software market analysis, enterprise adoption trends" },
            { id: 10, title: "Productivity Software Market Global Forecast", url: "https://dataintelo.com/report/global-productivity-software-market", content: "Market forecasts, regional analysis, competitive landscape" },
        ]
    },
    {
        category: "Technology Trends & Development",
        links: [
            { id: 11, title: "Local-First Development Changing Software Development", url: "https://www.heavybit.com/library/article/local-first-development", content: "Local-first advantages in latency, privacy, complexity reduction" },
            { id: 12, title: "How Generative AI Increases Workplace Productivity", url: "https://www.moveworks.com/us/en/resources/blog/how-does-generative-ai-increase-productivity", content: "AI productivity applications, ROI analysis, implementation strategies" },
            { id: 13, title: "Best-of-Breed vs All-in-One Tool Comparison", url: "https://www.trio.so/blog/best-of-breed-vs-all-in-one/", content: "Comprehensive analysis of integrated vs specialized tool strategies" },
            { id: 14, title: "Local-First Software Movement Buzz", url: "https://www.devprojournal.com/software-development-trends/whats-the-buzz-about-local-first-software-movement/", content: "Local-first adoption trends, developer perspectives, market momentum" },
            { id: 15, title: "Economic Potential of Generative AI", url: "https://www.mckinsey.com/capabilities/mckinsey-digital/our-insights/the-economic-potential-of-generative-ai-the-next-productivity-frontier", content: "AI productivity impact: 0.1-0.6% annual growth through 2040" },
        ]
    },
    {
        category: "Educational Technology Market",
        links: [
            { id: 16, title: "EdTech and Smart Classrooms Market", url: "https://www.marketsandmarkets.com/Market-Reports/educational-technology-ed-tech-market-1066.html", content: "EdTech market size, classroom technology adoption trends" },
            { id: 17, title: "EdTech and Smart Classrooms Market Report 2025", url: "https://www.researchandmarkets.com/reports/5939235/edtech-smart-classrooms-market-report", content: "Market valued at $197.3 billion in 2025, projected $353.1 billion by 2030" },
            { id: 18, title: "Education Technology Market Industry Report", url: "https://www.grandviewresearch.com/industry-analysis/education-technology-market", content: "Market growth from $163.49 billion (2024) to $348.41 billion (2030)" },
            { id: 19, title: "Educational Technology Market Size Analysis", url: "https://www.precedenceresearch.com/educational-technology-market", content: "EdTech market drivers, regional analysis, competitive landscape" },
        ]
    },
    {
        category: "Privacy & Security Concerns",
        links: [
            { id: 20, title: "Is Notion Secure? Data Security Analysis", url: "https://www.polymerhq.io/blog/is-notion-secure-what-you-need-to-know-about-notion-vulnerabilities/", content: "Notion security vulnerabilities, data breach risks, privacy concerns" },
            { id: 21, title: "Is Notion Secure? Security Risks Guide", url: "https://www.metomic.io/resource-centre/is-notion-secure", content: "Notion security analysis, enterprise compliance issues" },
            { id: 22, title: "Reddit: Is Notion Secure in Terms of Data Privacy?", url: "https://www.reddit.com/r/Notion/comments/197z04q/is_notion_secure_in_terms_of_data_privacy/", content: "User discussions about Notion privacy concerns, alternative solutions" },
            { id: 23, title: "Privacy Guides Community Discussion on Notion", url: "https://discuss.privacyguides.net/t/what-do-you-think-about-notion/18320", content: "Privacy-focused community evaluation of Notion's security practices" },
        ]
    },
    {
        category: "Productivity & Context Switching Issues",
        links: [
            { id: 24, title: "Context Switching Killing Productivity at Work", url: "https://conclude.io/blog/context-switching-is-killing-your-productivity/", content: "10 apps/day usage, 1,200 daily toggles, 4 hours/week lost reorienting" },
            { id: 25, title: "Context Switching: Silent Killer of Developer Productivity", url: "https://www.hatica.io/blog/context-switching-killing-developer-productivity/", content: "25-minute refocus time after context switches, productivity impact" },
            { id: 26, title: "How Context Switching Sabotages Productivity", url: "https://www.todoist.com/inspiration/context-switching", content: "Cognitive costs of task switching, productivity optimization strategies" },
            { id: 27, title: "Time Wasted Toggling Between Applications", url: "https://hbr.org/2022/08/how-much-time-and-energy-do-we-waste-toggling-between-applications", content: "Harvard Business Review analysis of app fragmentation costs" },
        ]
    },
    {
        category: "Educational Administration Challenges",
        links: [
            { id: 28, title: "Manual Attendance Tracking Challenges", url: "https://softdunamis.com/blog/manual-attendance-marking/", content: "Error rates 1-3%, 10 minutes/day per teacher, 400+ hours/year waste" },
            { id: 29, title: "Hidden Costs of Manual Attendance Tracking", url: "https://www.orah.com/blog/hidden-costs-of-manual-attendance", content: "Administrative burden, accuracy issues, time waste analysis" },
            { id: 30, title: "University Staff Challenges - Timetable Generation", url: "https://www.edtex.in/post/what-are-the-challenges-faced-by-university-staff-due-to-the-lack-of-it-and-automation-systems-for-efficient-timetable-generation-and-management", content: "Manual timetabling complexity, resource allocation challenges" },
            { id: 31, title: "Comparative Analysis: Manual vs Automatic Attendance", url: "https://ijcsmc.com/docs/papers/December2024/V13I12202407.pdf", content: "Manual: 5-8 experts, 12-15 days; Automated: 3 staff, 3-5 days" },
        ]
    },
    {
        category: "Tool Comparisons & Competitive Analysis",
        links: [
            { id: 32, title: "Obsidian vs Notion Ultimate Comparison 2025", url: "https://photes.io/blog/posts/obsidian-vs-notion", content: "Feature comparison, customization capabilities, learning curves" },
            { id: 33, title: "Notion Offline vs Obsidian Comparison", url: "https://tokie.is/blog/notion-offline-mode-vs-obsidian-expectations-reality-and-a-new-local-first-alternative", content: "Local-first alternatives analysis, offline functionality comparison" },
            { id: 34, title: "Obsidian vs Notion: Which is Best?", url: "https://zapier.com/blog/obsidian-vs-notion/", content: "Comprehensive feature comparison, use case analysis" },
            { id: 35, title: "Anytype vs Obsidian: Which Note-Taking App Wins 2025?", url: "https://clickup.com/blog/anytype-vs-obsidian/", content: "Detailed comparison of customization, features, user experience" },
        ]
    },
    {
        category: "Mind Mapping Market Analysis",
        links: [
            { id: 36, title: "Mind Mapping Software Market Size and Projections", url: "https://www.marketresearchintellect.com/product/global-mind-mapping-software-market-size-and-forecast/", content: "Market valued at $500 million (2024), projected $1.2 billion (2033)" },
            { id: 37, title: "Mind Mapping Software Market Industry Analysis 2034", url: "https://www.businessresearchinsights.com/market-reports/mind-mapping-software-market-125488", content: "Comprehensive market analysis, growth drivers, competitive landscape" },
            { id: 38, title: "Mind Mapping Software Market Report", url: "https://dataintelo.com/report/global-mind-mapping-software-market", content: "Global market valued $2.5 billion (2023), projected $6.3 billion (2032)" },
        ]
    },
    {
        category: "AI Productivity Tools & Implementation",
        links: [
            { id: 39, title: "50+ AI Productivity Tools Testing Results", url: "https://www.usemotion.com/blog/ai-productivity-tools.html", content: "Comprehensive AI tool evaluation, effectiveness analysis" },
            { id: 40, title: "20 Best AI Productivity Tools for 2025", url: "https://www.ringcentral.com/us/en/blog/ai-productivity-tools/", content: "AI tool recommendations, productivity impact analysis" },
            { id: 41, title: "Best AI Productivity Tools in 2025", url: "https://zapier.com/blog/best-ai-productivity-tools/", content: "Tool reviews, automation capabilities, workflow integration" },
        ]
    },
    {
        category: "Academic Scheduling & Timetabling",
        links: [
            { id: 42, title: "School Timetable Software Market Dynamics", url: "https://www.datainsightsmarket.com/reports/school-timetable-software-1985290", content: "Market drivers, automation benefits, institutional adoption trends" },
            { id: 43, title: "Academic Scheduling Software Market Forecast", url: "https://www.verifiedmarketresearch.com/product/academic-scheduling-software-market/", content: "Market valued $14.2 billion (2025), projected $51.3 billion (2035)" },
            { id: 44, title: "Academic Scheduling Software Market", url: "https://www.futuremarketinsights.com/reports/academic-scheduling-software-market", content: "13.4% CAGR growth, institutional adoption drivers" },
        ]
    },
    {
        category: "Monetization Strategies & Business Models",
        links: [
            { id: 45, title: "12 Software Monetization Strategies", url: "https://www.paddle.com/resources/software-monetization", content: "Revenue models, pricing strategies, subscription vs one-time purchase" },
            { id: 46, title: "Subscription vs One-Time Purchase Analysis", url: "https://www.switcherstudio.com/blog/one-time-vs-recurring-payments/", content: "Business model comparison, customer preference trends" },
            { id: 47, title: "One-Time Purchase vs Subscriptions", url: "https://appstle.com/blog/one-time-purchase-vs-subscriptions-shopify-model/", content: "Revenue model analysis, customer lifetime value comparison" },
        ]
    },
    {
        category: "Educational Technology Purchasing",
        links: [
            { id: 48, title: "How District Leaders Make EdTech Purchasing Decisions", url: "https://www.edsurge.com/news/2024-06-24-how-district-leaders-make-edtech-purchasing-decisions", content: "Decision-making processes, stakeholder influence, budget considerations" },
            { id: 49, title: "EdTech Purchasing Process Expert Analysis", url: "https://iste.org/blog/experts-weigh-in-on-the-ed-tech-purchasing-process", content: "Institutional purchasing workflows, evaluation criteria" },
            { id: 50, title: "Who Makes Purchasing Decisions for Schools?", url: "https://agile-ed.com/resources/who-makes-purchasing-decisions-for-schools-exploring-critical-education-decision-makers/", content: "91% involvement from chief academic officers, decision-maker hierarchy" },
        ]
    },
];

const ResearchPage: React.FC = () => {
  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <h1 className="text-4xl font-bold text-center text-foreground mb-4" style={{ fontFamily: "'Syne', sans-serif" }}>
        Market Research & References
      </h1>
      <p className="text-center text-muted-foreground -mt-6 mb-12 max-w-3xl mx-auto">
        A curated list of references and resources used for market analysis, problem validation, and competitive research for Maven.
      </p>

      {researchData.map((categoryData) => (
        <Section key={categoryData.category} title={categoryData.category}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 not-prose">
            {categoryData.links.map((link) => (
              <div key={link.id} className="p-4 bg-secondary/50 rounded-lg border border-border/50 transition-all hover:border-primary/50 hover:bg-secondary">
                <h3 className="font-semibold text-foreground/90">
                  <a href={link.url} target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors flex items-start gap-3">
                    <span className="bg-accent text-primary font-mono text-xs rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 mt-1">{link.id}</span>
                    <span>{link.title}</span>
                  </a>
                </h3>
                <p className="text-xs text-muted-foreground mt-2 pl-9 break-all flex items-center gap-1.5">
                  <Link size={12}/>
                  {link.url}
                </p>
                <p className="text-sm text-foreground/80 mt-2 pl-9">{link.content}</p>
              </div>
            ))}
          </div>
        </Section>
      ))}
    </div>
  );
};

export default ResearchPage;
