export interface ServicePreset {
  id: string
  label: string
  titleEn: string
  titleAr: string
  scopeEn: string
  scopeAr: string
  defaultBillingCycle: string
  suggestedDuration: string
}

export const DURATION_PRESETS = [
  {
    label: '6 Months',
    labelAr: '٦ أشهر',
    months: 6,
  },
  {
    label: '1 Year (12 Months)',
    labelAr: 'سنة واحدة (١٢ شهراً)',
    months: 12,
  },
  {
    label: '2 Years (24 Months)',
    labelAr: 'سنتان (٢٤ شهراً)',
    months: 24,
  },
  {
    label: '25 Months',
    labelAr: '٢٥ شهراً (سنتان وشهر)',
    months: 25,
  },
  {
    label: '3 Months (Quarterly)',
    labelAr: '٣ أشهر (ربع سنوي)',
    months: 3,
  },
  {
    label: 'Custom Duration',
    labelAr: 'مدة مخصصة',
    months: 0,
  },
]

export const SERVICE_PRESETS: ServicePreset[] = [
  {
    id: 'digital-marketing',
    label: 'Digital Marketing & Growth Ads',
    titleEn: 'Full-Stack Digital Marketing & Paid Advertising Management',
    titleAr: 'إدارة الحملات الإعلانية والتسويق الرقمي المتكامل وتحقيق النمو',
    scopeEn: `• Strategy & Campaign Management across Meta (Facebook & Instagram), TikTok, and Google Ads.
• Audience targeting, retargeting funnels, and demographic segmentation.
• Creative ad copywriting, visual asset optimization, and A/B split testing.
• Daily campaign monitoring, bid optimization, and cost-per-lead reduction.
• Conversion tracking, pixel integration, and weekly analytics reporting.
• Dedicated account manager and monthly performance review sessions.`,
    scopeAr: `• إعداد وتخطيط الاستراتيجية التسويقية وإدارة الحملات الإعلانية الممولة عبر منصات ميتا (فيسبوك وإنستغرام)، تيك توك، وإعلانات جوجل.
• الاستهداف الدقيق للجماهير المستهدفة، بناء مسارات إعادة الاستهداف (Retargeting) وتجزئة الشرائح.
• كتابة النصوص الإعلانية الإبداعية، تحسين المحتوى المرئي، واختبارات الأداء المقارنة (A/B Testing).
• المراقبة والمتابعة اليومية للمؤشرات الإعلانية، تحسين عروض الأسعار وخفض تكلفة الاستحواذ على العملاء.
• إعداد وتفعيل بيكسل التتبع وربط أدوات التحليلات وإصدار التقارير الأسبوعية والشهرية المفصلة.
• تعيين مدير حساب مخصص وجلسات دورية لمراجعة وتقييم مؤشرات الأداء مع العميل.`,
    defaultBillingCycle: 'MONTHLY',
    suggestedDuration: '1 Year (12 Months)',
  },
  {
    id: 'web-development',
    label: 'Web & Platform Development',
    titleEn: 'Custom Website Design, Platform Development & Maintenance',
    titleAr: 'تطوير وتصميم المواقع والمنصات الإلكترونية والصيانة الفنية',
    scopeEn: `• End-to-end bespoke UI/UX design aligned with brand identity and modern responsive standards.
• Full-stack frontend and backend development with Next.js, React, and robust database architecture.
• High-performance search engine optimization (SEO), ultra-fast load speed, and mobile responsiveness.
• Integration with client CRM, WhatsApp APIs, custom contact forms, and analytical dashboards.
• SSL certification, cloud hosting setup, anti-spam protections, and security hardening.
• Comprehensive quality assurance (QA), technical documentation, and post-launch maintenance.`,
    scopeAr: `• تصميم متكامل لواجهات وتجربة المستخدم (UI/UX) متوافق مع الهوية البصرية ومعايير التصفح الحديثة.
• تطوير وبرمجة شاملة للواجهات الأمامية والخلفية باستخدام أحدث التقنيات مع بنية قواعد بيانات فائقة الأمان.
• تحسين سرعة التصفح والاستجابة على كافة الأجهزة والشاشات والتوافق التام مع محركات البحث.
• ربط المنصة بنظام إدارة علاقات العملاء (CRM)، وواجهات واتساب، والنماذج التفاعلية وأنظمة الإحصائيات.
• ضبط شهادات الأمان (SSL)، وتجهيز الخوادم السحابية، وأنظمة حماية النطاق والبريد الإلكتروني.
• فحص الجودة الشامل، وتقديم التوثيق التقني، والدعم الفني والصيانة الدورية بعد التدشين.`,
    defaultBillingCycle: 'MILESTONES',
    suggestedDuration: '6 Months',
  },
  {
    id: 'social-media',
    label: 'Social Media & Content Production',
    titleEn: 'Social Media Management, Creative Content & Community Engagement',
    titleAr: 'إدارة منصات التواصل الاجتماعي، صناعة المحتوى الإبداعي وإدارة المجتمع',
    scopeEn: `• Monthly content calendar creation with bilingual captions and strategic publishing schedule.
• Graphic design of branded posts, promotional carousels, and visual identity storytelling.
• Short-form video production and editing (Reels / TikTok / Shorts) highlighting services and offers.
• Community moderation, direct message (DM) triaging, and engagement rate optimization.
• Influencer collaboration coordination and hashtag reach amplification.
• Comprehensive monthly social analytics report detailing reach, engagement, and follower growth.`,
    scopeAr: `• إعداد الخطة والتقويم الشهري للمحتوى باللغتين العربية والإنجليزية وجدولة النشر الاستراتيجي.
• تصميم المنشورات التفاعلية والإنفوجرافيك المتناسق مع الهوية البصرية للعلامة التجارية.
• تصوير وإنتاج وتحرير مقاطع الفيديو القصيرة (Reels / TikTok / Shorts) للترويج للمنتجات والخدمات.
• إدارة التفاعل، والرد على الرسائل والتعليقات، وتعزيز تفاعل الجمهور والمتابعين.
• التنسيق مع المؤثرين وصناع المحتوى وتوسيع نطاق الوصول العضوي للحسابات.
• إعداد تقرير شهري تفصيلي يوضح نمو المتابعين، ومعدلات التفاعل والوصول، والتوصيات التطويرية.`,
    defaultBillingCycle: 'MONTHLY',
    suggestedDuration: '1 Year (12 Months)',
  },
  {
    id: 'seo-growth',
    label: 'SEO & Organic Search Growth',
    titleEn: 'Search Engine Optimization (SEO), Technical Audit & Google Ranking',
    titleAr: 'تحسين محركات البحث (SEO)، التدقيق التقني وتصدر نتائج البحث',
    scopeEn: `• Comprehensive technical website audit, keyword research, and competitor gap analysis.
• On-page optimization: meta tags, headers, schema markup, and internal linking structure.
• Content optimization and SEO-driven Arabic & English blog/article publishing.
• High-authority backlink building and digital PR outreach.
• Google Search Console and Google Analytics configuration and monthly ranking progress tracking.`,
    scopeAr: `• الفحص والتدقيق التقني الشامل للموقع، وبحث الكلمات المفتاحية وتحليل المنافسين في السوق.
• التحسين الداخلي لصفحات الموقع (On-Page SEO): العناوين، الأوصاف، الوسوم الهيكلية والربط الداخلي.
• تحسين المحتوى وكتابة ونشر مقالات موجهة لمحركات البحث باللغتين العربية والإنجليزية.
• بناء الروابط الخلفية القوية والموثوقة (Backlinks) لرفع سلطة النطاق في محرك بحث جوجل.
• ضبط منصات تحليلات جوجل وإصدار تقارير دورية توضح تحسن ترتيب الكلمات المفتاحية وزيادة الزيارات العضوية.`,
    defaultBillingCycle: 'MONTHLY',
    suggestedDuration: '1 Year (12 Months)',
  },
  {
    id: 'full-retainer',
    label: 'All-in-One Comprehensive Retainer',
    titleEn: 'Comprehensive Digital Transformation & Full-Stack Agency Retainer',
    titleAr: 'عقد التحول الرقمي الشامل والإدارة التقنية والتسويقية المتكاملة',
    scopeEn: `• Complete end-to-end management of digital presence, custom software, and marketing funnels.
• Integrated performance advertising across all major digital channels.
• Ongoing website updates, feature engineering, landing page creation, and technical support.
• Social media management, high-end creative direction, and multi-format media production.
• Lead generation optimization, CRM workflow integration, and sales team pipeline alignment.
• Bi-weekly strategic steering meetings with Adonix executive leadership.`,
    scopeAr: `• إدارة شاملة وكاملة للحضور الرقمي والأنظمة البرمجية ومسارات التسويق والمبيعات للعميل.
• إدارة الحملات الإعلانية عالية الأداء على جميع المنصات الإعلانية الرقمية الرئيسية.
• التحديث والتطوير المستمر للموقع الإلكتروني، بناء صفحات الهبوط، والدعم الفني والتقني الفوري.
• إدارة منصات التواصل الاجتماعي بالكامل وصناعة المحتوى المرئي والإبداعي بأعلى جودة.
• تحسين وتدفق العملاء المحتملين والربط بنظام إدارة علاقات العملاء (CRM) لتمكين فريق المبيعات.
• اجتماعات توجيهية استراتيجية نصف شهرية مع قيادة شركة أدونيكس لمتابعة النتائج وتحقيق المستهدفات.`,
    defaultBillingCycle: 'MONTHLY',
    suggestedDuration: '2 Years (24 Months)',
  },
]

