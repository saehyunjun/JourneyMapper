---
title: "How argenX Set the Pace in the Race for Community Attention"
summary: "How argenX used patient-centered storytelling, lifestyle content, and aggressive digital investment to establish MG United as a dominant voice in the MG community."
tags: [myasthenia-gravis, rare-disease, early-engagement, unbranded, branded]
hero: "/content-assets/casestudies/argenx-hero.png"
color: "mint"
---

<script>
  import Takeaways from '$lib/content/components/Takeaways.svelte';
  import Callout from '$lib/content/components/Callout.svelte';
  import Figure from '$lib/content/components/Figure.svelte';
  import BarX from '$lib/charts/BarX.svelte';
  import BarY from '$lib/charts/BarY.svelte';
  import BarYGrouped from '$lib/charts/BarYGrouped.svelte';
  import BarXStacked from '$lib/charts/BarXStacked.svelte';
  import Radar from '$lib/charts/Radar.svelte';
  import contentMix from './data/mg-united-content-mix.json';
  import marketingSpend from './data/marketing-spend.json';
  import campaignComparison from './data/campaign-comparison.json';
  import keywordTargets from './data/keyword-targets.json';

  // Figure 1 — Content mix (grouped vertical bars)
  const contentMixFlat = contentMix.categories.flatMap((c) =>
    contentMix.series.map((s) => ({
      category: c.label,
      type: c.type,
      group: s.label,
      year: s.year,
      value: s.values[c.key] ?? 0
    }))
  );
  const contentMixColor = (d) => {
    if (d.type === 'lifestyle') return d.year === 2020 ? 'var(--midgreen)' : 'var(--green)';
    return d.year === 2020 ? 'var(--midgrayblue)' : 'var(--darkgrayblue)';
  };
  const contentMixLegend = [
    { label: 'Launch (June 2020) · Healthcare', color: 'var(--midgrayblue)' },
    { label: 'Launch (June 2020) · Lifestyle', color: 'var(--midgreen)' },
    { label: 'Expansion (Oct 2024) · Healthcare', color: 'var(--darkgrayblue)' },
    { label: 'Expansion (Oct 2024) · Lifestyle', color: 'var(--green)' }
  ];
  const contentMixTooltip = (d) => ({
    title: d.category,
    meta: d.group,
    swatchColor: contentMixColor(d),
    value: d.value,
    unit: 'pages',
    extra: d.type === 'lifestyle' ? 'Lifestyle content' : 'Healthcare content'
  });

  // Figure 1 (radar variant) — series colored per group
  const contentMixGroupColor = (g) =>
    g.startsWith('Launch') ? 'var(--midgrayblue)' : 'var(--green)';
  const contentMixRadarLegend = [
    { label: 'Launch (June 2020)', color: 'var(--midgrayblue)' },
    { label: 'Expansion (Oct 2024)', color: 'var(--green)' }
  ];
  const contentMixRadarTooltip = (d) => ({
    title: d.category,
    meta: d.group,
    swatchColor: contentMixGroupColor(d.group),
    value: d.value,
    unit: 'pages'
  });

  // Figure 2 — Marketing spend (single-series vertical bars)
  const spendValueFormat = (v) => `$${Number(v).toFixed(1)}M`;
  const spendColor = (d) => (d.estimated ? 'var(--midgrayblue)' : 'var(--darkgrayblue)');
  const spendLabelFormat = (d) => `${d.year}${d.estimated ? ' (est.)' : ''}`;
  const spendTooltip = (d) => ({
    title: `${d.year}${d.estimated ? ' (est.)' : ''}`,
    value: spendValueFormat(d.spend_millions),
    unit: 'marketing services',
    extra: d.yoy_change_pct !== null ? `+${d.yoy_change_pct}% YoY` : undefined
  });

  // Figure 3 — Campaign comparison (horizontal stacked bars)
  const campaignSegments = [
    { key: 'healthcare_pages', label: 'Healthcare pages', color: 'var(--midgrayblue)' },
    { key: 'lifestyle_pages', label: 'Lifestyle pages', color: 'var(--green)' }
  ];
  const campaignAnnotate = (d) =>
    d.ratio_lifestyle_to_healthcare > 0
      ? `${d.ratio_lifestyle_to_healthcare.toFixed(2)}× lifestyle`
      : '0× lifestyle';
  const campaignTooltip = (d, seg) => ({
    title: d.label,
    meta: d.sponsor,
    swatchColor: seg.color,
    value: d[seg.key],
    unit: seg.label.toLowerCase(),
    extra: `${d.total_pages} total · ${d.ratio_lifestyle_to_healthcare.toFixed(2)}× lifestyle ratio`
  });

  // Figure 4 — Keyword targets (horizontal bars)
  const keywordLegend = [
    { label: 'argenX', color: 'var(--darkgrayblue)' },
    { label: 'Alexion', color: 'var(--orange)' }
  ];
  const keywordColor = (d) => (d.sponsor === 'argenX' ? 'var(--darkgrayblue)' : 'var(--orange)');
  const keywordTooltip = (d) => ({
    title: d.domain,
    meta: `${d.sponsor} · ${d.audience === 'hcp' ? 'HCP' : 'Patient'} ${d.branded ? '· Branded' : '· Unbranded'}`,
    value: d.keyword_targets,
    unit: 'keyword targets'
  });
</script>

<Takeaways title="Takeaways">

1. argenX transformed MG patient engagement by centering emotional and lifestyle-oriented experiences rather than limiting communication to clinical education.

2. MG United established an early and durable share-of-voice advantage through sustained investment, multimodal content, and aggressive search strategy.

3. Competitors such as Alexion have already begun adapting their engagement models to resemble MG United's structure and tone — but face structural disadvantages competing against an entrenched platform.

4. Future differentiation opportunities likely exist within underserved patient subgroups and highly specific quality-of-life concerns, particularly young professionals living with MG.

</Takeaways>

## Overview

Beginning in 2020, argenX fundamentally shifted its messaging strategy around myasthenia gravis (MG), centering patient stories and experiences across corporate communications and patient engagement efforts.

This transformation coincided with promising Phase 3 MG trial results and represented a broader strategic effort to establish argenX as a trusted, community-centered voice before larger competitors fully entered the MG space.

## A Shift Toward Patient-Centered Corporate Messaging

Prior to 2020, argenX annual reports largely resembled conventional biotech shareholder communications: financials, risk disclosures, and operational updates. For example, though the company's 2019 annual report **mentions the word "patient" 326 times**, each instance relates to regulatory risk, clinical operations, and other factors that impact the sponsor first and foremost. 
<Figure
  src="/content-assets/casestudies/argenx2019report.png"
  alt="2020 annual report cover with patient-facing language"
  caption="The 2020 annual report opened with direct patient address."
/>

<Figure
  src="/content-assets/casestudies/argenx2020report.png"
  alt="2020 annual report cover with patient-facing language"
  caption="The 2020 annual report opened with direct patient address."
/>

The 2020 annual report marked a dramatic change. Before even reaching the table of contents, readers encountered bold patient-facing language:

> "We see you, we hear you, we are here with you."

The report described argenX as:

> "As your ally, we pioneer innovations…"

The use of emotionally direct and explicitly patient-centered la
nguage — especially terms like "ally" — signaled the unusually empowered role patient advocacy and patient marketing held within argenX's organization.

This approach was not purely altruistic. argenX, still preparing for the launch of its first commercial MG product, faced looming competition from larger players including Alexion, Janssen, and Amgen. The company effectively placed a strategic bet that authentic patient-centered engagement could build meaningful share-of-voice and long-term community goodwill before competitors established similar relationships.

## MG United: A Different Kind of Unbranded Campaign

The clearest expression of this strategy emerged through MG United, argenX's unbranded MG patient engagement platform.

Rather than focusing exclusively on medical information, MG United positioned itself as a broader lifestyle and support ecosystem for patients living with MG.

Content categories at launch included:

- Navigating healthcare
- Explaining MG
- Disease and treatment information
- Emotional wellness
- Food and nutrition
- Advocacy and patient stories

Notably, lifestyle-oriented and patient-story content outweighed purely healthcare-focused materials. At launch in June 2020, MG United included 20 healthcare-focused pages compared with 28 lifestyle and patient-story pages.

This broader focus differentiated MG United from many traditional pharma-sponsored patient resources, which often center almost exclusively on treatment education and clinical information. MG United instead attempted to speak to the entire day-to-day patient experience.

## Expansion of Lifestyle and Emotional Content

By October 2024, MG United had expanded significantly and further concentrated on lifestyle-focused materials.

<Radar
  figure="1"
  caption="MG United content mix, June 2020 vs October 2024"
  data={contentMixFlat}
  category="category"
  group="group"
  value="value"
  colorBy={contentMixGroupColor}
  legend={contentMixRadarLegend}
  tooltip={contentMixRadarTooltip}
/>

The platform increasingly emphasized:

- Emotional wellness
- Daily living support
- Nutrition and recipes
- Career planning
- Long-term quality-of-life concerns

The ratio of lifestyle-focused to healthcare-focused content grew substantially — from roughly 1.4x in 2020 to 2.76x in 2024 — suggesting argenX identified lifestyle-oriented content as an effective mechanism for sustained patient engagement and ongoing community participation.

## Investment and Scale

Financial reports from 2021–2023 suggest argenX significantly expanded investment into marketing services and unbranded engagement initiatives, with marketing services spend growing from an estimated $66.78M in 2021 to $202.15M in 2023 — a 74% year-over-year increase in both 2022 and 2023.

<BarY
  figure="2"
  caption="argenX marketing services spend, 2021–2023"
  data={marketingSpend.points}
  label="year"
  value="spend_millions"
  labelFormat={spendLabelFormat}
  valueFormat={spendValueFormat}
  colorBy={spendColor}
  tooltip={spendTooltip}
  source="argenX financial reports"
/>

This investment funded:

- Aggressive publishing schedules
- Seasonal lifestyle content
- Video production
- Interactive tools
- Career and future planning resources
- International campaign expansion

MG United variants were launched internationally, including localized experiences in Germany and Japan. argenX also expanded this broader patient-engagement philosophy into additional therapeutic areas, including CIDP.

## Alexion's Strategic Pivot

The success and visibility of MG United appears to have influenced competitors — most notably Alexion.

Alexion's original unbranded campaign, *Understanding gMG*, launched in December 2021 and reflected a more traditional pharmaceutical patient engagement model: highly clinical tone, limited content volume, focused almost entirely on healthcare education, with minimal emotional or lifestyle-oriented materials.

The campaign contained only 7 healthcare-focused pages and zero lifestyle pages. The implicit framing appeared transactional:

> "You probably need us, so come learn more."

The site evolved very little over time.

### More Than MG: Adopting the MG United Playbook

In July 2024, Alexion sunsetted *Understanding gMG* and redirected users to a new campaign: *More Than MG*.

The refreshed initiative adopted many strategic elements pioneered by MG United:

- Whole-patient-experience framing
- Lifestyle-focused content
- Videos and interactive resources
- Emotional wellness materials
- Expanded patient resources

Alexion's revised content mix produced a lifestyle-to-healthcare ratio of approximately 2.3x, approaching MG United's 2.76x ratio.

<BarXStacked
  figure="3"
  caption="Healthcare vs lifestyle pages across unbranded MG campaigns"
  data={campaignComparison.campaigns}
  label="label"
  segments={campaignSegments}
  tooltip={campaignTooltip}
  annotate={campaignAnnotate}
  axisCaption="Pages"
/>

## Organic and Paid Search Dominance

argenX strengthened MG United's reach through aggressive paid and organic digital strategy. As of October 2024, MG-United.com targeted approximately 115 keywords, with Vyvgart.com targeting an additional 360 — dwarfing competitor reach (More Than MG: 17, Understanding gMG HCP: 48).

<BarX
  figure="4"
  caption="Search keyword targets by MG-related site, October 2024"
  data={keywordTargets.sites}
  label="domain"
  value="keyword_targets"
  colorBy={keywordColor}
  legend={keywordLegend}
  tooltip={keywordTooltip}
/>

MG United targeted search queries ranging from highly clinical terms to lifestyle-oriented concerns, including:

- "myasthenic crisis icd 10"
- "what is myasthenia gravis"
- "Foods to Avoid with MG"

This broad keyword strategy significantly expanded argenX's share-of-voice within MG search behavior and created an ecosystem connecting:

- Unbranded education
- Lifestyle engagement
- Branded treatment resources
- HCP-focused materials

Together, these efforts established argenX as a dominant digital presence within the MG landscape.

## Competitive Challenges for Alexion

Alexion's newer campaign faces structural disadvantages. Approximately 85% of More Than MG content reportedly overlaps with similar material already available on MG United.

While some overlap is inevitable for disease education topics, significant duplication also exists across exercise content, nutrition content, lifestyle guidance, and emotional wellness materials.

As a result, More Than MG is forced to compete directly against an entrenched platform with:

- Higher production quality
- More extensive content libraries
- Downloadable assets
- Interactive experiences
- Stronger SEO presence
- Longer-standing community familiarity

## Emerging Opportunity Areas

Despite argenX's leadership position, several patient populations remain under-addressed. One especially notable opportunity area is younger professionals living with MG.

<Callout variant="info" title="Underserved Topics">

- Early-stage career management
- Remote work adaptation
- Urban living
- Dating and intimacy
- Smart home and technology use
- Social identity and independence

</Callout>

A hypothetical content initiative targeted toward young professional women aged 21–40 might explore concepts like "The Remote Work Command Center," "Digital Fatigue Management," "I'm Tired…of Networking!," "MG Apartment Hacks," "Nerding Out for MG," "One Pot Meal Plans," and "MG is My Third Wheel."

Future competitors will benefit less from attempting to outscale MG United broadly and more from identifying niche audiences and underserved emotional or lifestyle conversations.

---

*Powered by PatientlyIQ · Built for clinical insight*
