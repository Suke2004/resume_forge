import {
  CandidateProfile,
  LatexTemplate,
  ProjectItem,
  ResumeVersion,
  SkillItem,
  SkillStageConfig,
} from '../types/resume';
import {
  calculatePageFitAndSuggestions,
  computeSourceHash,
  generateCompleteLatexResume,
} from './latexEngine';

export const DEFAULT_SKILL_STAGE_CONFIG: SkillStageConfig = {
  stage1Label: 'STAGE 1, THE TRANSLATOR',
  stage1Subtitle: 'Core Languages & Primary Positioning Stack (Included in Resume)',
  stage2Label: 'STAGE 2, THE X-RAY',
  stage2Subtitle: 'ATS-Normalized Frameworks, Libraries & Cloud Architecture (Included in Resume)',
  stage3Label: 'STAGE 3, THE SURGEON',
  stage3Subtitle: 'Precision Engineering Tools, Hardware & Verification Systems (Included in Resume)',
  stage4Label: 'STAGE 4, THE EXAMINER',
  stage4Subtitle: 'Interview-Only / Exploratory & Excluded Skills (NEVER Included in Output)',
};

export const INITIAL_CANDIDATE_PROFILE: CandidateProfile = {
  fullName: 'Aarav Mehta',
  email: 'aarav.mehta@engineering.edu',
  phone: '+1 (415) 890-4321',
  location: 'San Francisco, CA',
  linkedinUrl: 'https://linkedin.com/in/aarav-mehta',
  githubUrl: 'https://github.com/aarav-mehta',
  portfolioUrl: 'https://aaravmehta.dev',
  education: [
    {
      id: 'edu-1',
      institution: 'University of California, Berkeley',
      degree: 'B.S. in Electrical Engineering and Computer Sciences (EECS)',
      location: 'Berkeley, CA',
      dates: 'Aug 2022 -- May 2026',
      gpa: '3.91/4.00',
      coursework:
        'Operating Systems, Distributed Systems, Machine Learning, Embedded Systems, Digital Integrated Circuits',
    },
  ],
  experience: [
    {
      id: 'exp-1',
      company: 'CloudScale Systems',
      role: 'Software Engineering Intern, Infrastructure & Data',
      location: 'San Jose, CA',
      dates: 'May 2025 -- Aug 2025',
      bullets: [
        'Engineered a high-throughput telemetry ingestion service in Go and Apache Kafka processing 45,000 events/sec with p99 latency under 18ms.',
        'Automated PostgreSQL query plan regression alerts across 14 microservice schemas, cutting slow-query incidents by 34% over 12 weeks.',
        'Built zero-downtime schema migration runners integrated with GitHub Actions CI pipelines and containerized staging environments.',
      ],
    },
    {
      id: 'exp-2',
      company: 'Berkeley Autonomous Microsystems Lab',
      role: 'Undergraduate Embedded & ML Researcher',
      location: 'Berkeley, CA',
      dates: 'Sep 2024 -- May 2025',
      bullets: [
        'Developed C++ sensor drivers and FreeRTOS task schedulers on STM32H7 microcontrollers for real-time inertial and ultrasonic telemetry.',
        'Implemented quantized anomaly detection inference pipelines reducing edge packet transmission overhead by 41% during field trials.',
      ],
    },
  ],
  achievements: [
    '1st Place Overall, CalHacks Embedded & Edge AI Track (2025) among 180+ competing engineering teams.',
    'Dean’s Honors List (All Semesters, 2022--2025) & IEEE Student Branch Technical Lead.',
  ],
  calibrationAnswers: {
    targetRoleAndCompanyType:
      'Full-Stack / Systems & Applied ML Engineer at high-growth cloud infrastructure or cyber-physical systems companies.',
    threeDifferentiators:
      '1) End-to-end ownership from bare-metal microcontroller/FPGA firmware up to distributed cloud backends; 2) Rigorous empirical benchmarking with verified production metrics; 3) Production-grade data pipelines combining statistical ML with low-latency systems.',
    headOnAddressing:
      'New grad transition from academic/internship scope to full-time production ownership—addressed by highlighting measurable throughput, latency, and reliability outcomes.',
    updatedAt: '2026-10-20T22:00:00.000Z',
  },
};

export const INITIAL_PROJECTS: ProjectItem[] = [
  {
    id: 'proj-churn-analytics',
    title: 'Customer Churn Prediction & Retention Analytics',
    sourceDescription:
      'Full reference description for AI only: Built an end-to-end machine learning pipeline in Python using scikit-learn, XGBoost, Pandas, and SQL to identify telecom and SaaS subscription customers at risk of churning. Performed feature engineering on 70,000+ historical customer records including billing tenure, support ticket velocity, and usage decay. Evaluated logistic regression, random forest, and gradient boosted trees using stratified 5-fold cross-validation, ROC-AUC (0.89), Precision-Recall AUC, and F1-score. Built an interactive cohort retention analytics workflow and dashboard to communicate risk segments and intervention ROI to product stakeholders.',
    verifiedFacts: [
      'Processed 70,000+ customer lifecycle records with automated feature engineering in Python, Pandas, and SQL',
      'Evaluated classification models (XGBoost, Random Forest, Logistic Regression) achieving 0.89 ROC-AUC on stratified validation splits',
      'Built an interactive cohort retention analytics workflow and SHAP explainability dashboard',
    ],
    defaultBullets: [
      'Developed a machine learning pipeline in Python, scikit-learn, and XGBoost to identify customers at risk of churn across 70,000+ verified lifecycle records.',
      'Evaluated classification models using stratified 5-fold cross-validation, achieving 0.89 ROC-AUC and 84% recall on high-risk cohorts.',
      'Built an interactive analytics workflow with SHAP feature attribution to communicate retention insights and intervention priorities.',
    ],
    domain: 'software',
    technologies: ['Python', 'scikit-learn', 'XGBoost', 'Pandas', 'SQL', 'SHAP'],
    keywords: [
      'machine learning',
      'churn prediction',
      'classification',
      'data pipeline',
      'retention analytics',
      'feature engineering',
      'ROC-AUC',
    ],
    githubUrl: 'https://github.com/aarav-mehta/customer-churn-analytics',
    priority: 1,
    metrics: ['70,000+ records processed', '0.89 ROC-AUC', '84% high-risk recall'],
    createdAt: '2026-09-10T10:00:00.000Z',
    updatedAt: '2026-10-15T14:30:00.000Z',
  },
  {
    id: 'proj-mineshield',
    title: 'Mineshield: Smart Mining Safety System',
    sourceDescription:
      'Full reference description for AI only: Designed and prototyped a hardware-software mining safety telemetry system integrating MQ-series hazardous gas sensors, DHT temperature/humidity sensors, and HC-SR04 ultrasonic structural proximity sensors with an Arduino Uno and ESP8266 Wi-Fi module. Implemented deterministic C/C++ firmware for multi-sensor ADC sampling, noise filtering, and wireless HTTP/MQTT telemetry streaming. Designed a real-time monitoring web dashboard displaying live underground sensor readings, historical trends, and automated acoustic/visual threshold alerts for hazardous methane or roof-convergence conditions.',
    verifiedFacts: [
      'Integrated MQ gas sensors and ultrasonic proximity sensors with Arduino Uno and ESP8266 hardware',
      'Implemented real-time C/C++ sensor data acquisition and wireless MQTT/HTTP telemetry streaming',
      'Designed a live monitoring dashboard displaying multi-node sensor readings and sub-second threshold alerts',
    ],
    defaultBullets: [
      'Integrated hazardous gas sensors and ultrasonic proximity sensors with Arduino Uno and ESP8266 hardware for underground safety monitoring.',
      'Implemented deterministic C/C++ sensor data acquisition, moving-average signal filtering, and wireless telemetry streaming.',
      'Designed a real-time web dashboard to visualize multi-sensor readings and trigger automated hazard threshold alerts.',
    ],
    domain: 'hybrid',
    technologies: ['Arduino Uno', 'ESP8266', 'Embedded C/C++', 'MQTT', 'Gas & Ultrasonic Sensors', 'React'],
    keywords: [
      'iot',
      'embedded systems',
      'arduino',
      'esp8266',
      'wireless telemetry',
      'sensor fusion',
      'safety monitoring',
      'hardware',
    ],
    githubUrl: 'https://github.com/aarav-mehta/mineshield-safety-iot',
    priority: 2,
    metrics: ['Sub-second hazard alert trigger', 'Multi-sensor ADC telemetry pipeline'],
    createdAt: '2026-08-20T09:00:00.000Z',
    updatedAt: '2026-10-12T11:20:00.000Z',
  },
  {
    id: 'proj-order-matching',
    title: 'ChronosBook: Low-Latency Limit Order Book & Matching Engine',
    sourceDescription:
      'Full reference description for AI only: Architected a deterministic price-time priority limit order book in Rust and Go capable of matching limit, market, and IOC orders. Used lock-free ring buffers and cache-aligned B-tree price levels to achieve 120,000+ orders/sec throughput with sub-50 microsecond median matching latency in benchmark suites. Exposed gRPC and WebSocket market data feeds backed by PostgreSQL audit journaling and Dockerized integration tests.',
    verifiedFacts: [
      'Implemented price-time priority limit order book in Rust with cache-aligned B-tree price levels',
      'Measured 120,000+ orders/sec throughput and <50us median matching latency in deterministic benchmarks',
      'Built gRPC order gateway and WebSocket L2 market-depth feed with PostgreSQL event journaling',
    ],
    defaultBullets: [
      'Architected a deterministic price-time priority matching engine in Rust using cache-aligned B-trees, sustaining 120,000+ orders/sec in benchmark suites.',
      'Engineered a gRPC order gateway and WebSocket L2 order-book publisher with sub-50 microsecond median matching latency.',
      'Implemented asynchronous PostgreSQL write-ahead event journaling and automated replay verification tests.',
    ],
    domain: 'software',
    technologies: ['Rust', 'Go', 'gRPC', 'WebSockets', 'PostgreSQL', 'Docker'],
    keywords: [
      'distributed systems',
      'low latency',
      'rust',
      'golang',
      'concurrency',
      'backend',
      'microservices',
      'grpc',
    ],
    githubUrl: 'https://github.com/aarav-mehta/chronosbook-engine',
    priority: 3,
    metrics: ['120,000+ orders/sec', '<50us median latency'],
    createdAt: '2026-07-15T12:00:00.000Z',
    updatedAt: '2026-10-01T16:45:00.000Z',
  },
  {
    id: 'proj-fpga-vision',
    title: 'FPGA Stereo Disparity & Ultrasonic Obstacle Accelerator',
    sourceDescription:
      'Full reference description for AI only: Designed a pipelined RTL hardware accelerator in SystemVerilog on a Xilinx Artix-7 FPGA for real-time stereo census transform and Hamming distance disparity estimation at 60 FPS (640x480). Interfaced high-speed SPI/UART telemetry to an onboard ARM Cortex-M4 controller without external DRAM bottlenecks. Verified cycle-accurate timing closure at 100 MHz using Vivado testbenches and logic analyzer captures.',
    verifiedFacts: [
      'Designed pipelined SystemVerilog RTL stereo disparity accelerator on Xilinx Artix-7 FPGA running at 100 MHz',
      'Achieved 60 FPS 640x480 depth map computation using BRAM line buffers with zero external DRAM dependency',
      'Verified timing closure and SPI telemetry interfacing via Vivado simulation testbenches',
    ],
    defaultBullets: [
      'Designed a pipelined SystemVerilog RTL stereo vision accelerator on a Xilinx Artix-7 FPGA achieving 60 FPS depth estimation at 100 MHz.',
      'Architected sliding-window BRAM line buffers for census transform and Hamming cost aggregation without external DRAM bottlenecks.',
      'Verified cycle-accurate timing closure and high-speed SPI host telemetry using Vivado testbenches and hardware logic analyzers.',
    ],
    domain: 'hardware',
    technologies: ['SystemVerilog', 'Xilinx Artix-7 FPGA', 'Vivado', 'SPI/UART', 'ARM Cortex-M4'],
    keywords: [
      'fpga',
      'verilog',
      'systemverilog',
      'rtl design',
      'hardware acceleration',
      'digital design',
      'computer architecture',
      'embedded',
    ],
    // Intentionally empty githubUrl to test optional GitHub link handling in LaTeX output!
    githubUrl: '',
    priority: 4,
    metrics: ['60 FPS @ 640x480', '100 MHz timing closure'],
    createdAt: '2026-06-11T08:00:00.000Z',
    updatedAt: '2026-09-28T19:00:00.000Z',
  },
  {
    id: 'proj-kube-guard',
    title: 'KubePulse: eBPF Container Network & Cost Profiler',
    sourceDescription:
      'Full reference description for AI only: Built an observability agent in Go and C (libbpf) attaching eBPF socket and kprobe programs to Linux kernel network paths to attribute cross-AZ Kubernetes pod traffic without sidecar proxies. Aggregated flow metrics into Prometheus and rendered topology heatmaps in Next.js and TypeScript.',
    verifiedFacts: [
      'Wrote C/libbpf eBPF kernel probes and Go userspace collectors for sidecar-free Kubernetes pod traffic accounting',
      'Kept CPU overhead below 1.2% on worker nodes while exporting Prometheus metrics and Next.js topology maps',
    ],
    defaultBullets: [
      'Built a sidecar-free Kubernetes network profiler using C (eBPF/libbpf) and Go to track cross-zone pod traffic with <1.2% CPU overhead.',
      'Exported cardinality-bounded Prometheus metrics and developed a Next.js/TypeScript topology visualizer to pinpoint costly inter-AZ data transfers.',
      'Automated Helm chart packaging and multi-node Kind cluster integration tests in GitHub Actions.',
    ],
    domain: 'software',
    technologies: ['Go', 'eBPF', 'C', 'Kubernetes', 'Prometheus', 'TypeScript', 'Next.js'],
    keywords: [
      'kubernetes',
      'ebpf',
      'cloud native',
      'observability',
      'golang',
      'linux kernel',
      'devops',
      'nextjs',
    ],
    githubUrl: 'https://github.com/aarav-mehta/kubepulse-ebpf',
    priority: 5,
    metrics: ['<1.2% node CPU overhead'],
    createdAt: '2026-05-03T15:00:00.000Z',
    updatedAt: '2026-09-19T10:15:00.000Z',
  },
];

export const INITIAL_SKILLS: SkillItem[] = [
  // STAGE 1, THE TRANSLATOR (Included)
  {
    id: 'sk-1',
    name: 'Python',
    category: 'Languages',
    stage: 1,
    verified: true,
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z',
  },
  {
    id: 'sk-2',
    name: 'TypeScript',
    category: 'Languages',
    stage: 1,
    verified: true,
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z',
  },
  {
    id: 'sk-3',
    name: 'Go',
    category: 'Languages',
    stage: 1,
    verified: true,
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z',
  },
  {
    id: 'sk-4',
    name: 'Rust',
    category: 'Languages',
    stage: 1,
    verified: true,
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z',
  },
  {
    id: 'sk-5',
    name: 'C/C++',
    category: 'Languages',
    stage: 1,
    verified: true,
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z',
  },
  {
    id: 'sk-6',
    name: 'SQL (PostgreSQL)',
    category: 'Languages',
    stage: 1,
    verified: true,
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z',
  },
  {
    id: 'sk-7',
    name: 'SystemVerilog',
    category: 'Hardware HDL',
    stage: 1,
    verified: true,
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z',
  },

  // STAGE 2, THE X-RAY (Included)
  {
    id: 'sk-8',
    name: 'React & Next.js',
    category: 'Frameworks',
    stage: 2,
    verified: true,
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z',
  },
  {
    id: 'sk-9',
    name: 'Node.js & Express',
    category: 'Frameworks',
    stage: 2,
    verified: true,
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z',
  },
  {
    id: 'sk-10',
    name: 'scikit-learn & XGBoost',
    category: 'ML & Data',
    stage: 2,
    verified: true,
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z',
  },
  {
    id: 'sk-11',
    name: 'Pandas & NumPy',
    category: 'ML & Data',
    stage: 2,
    verified: true,
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z',
  },
  {
    id: 'sk-12',
    name: 'Apache Kafka & gRPC',
    category: 'Distributed Systems',
    stage: 2,
    verified: true,
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z',
  },

  // STAGE 3, THE SURGEON (Included)
  {
    id: 'sk-13',
    name: 'Docker & Kubernetes',
    category: 'Infrastructure',
    stage: 3,
    verified: true,
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z',
  },
  {
    id: 'sk-14',
    name: 'Linux & eBPF',
    category: 'Systems',
    stage: 3,
    verified: true,
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z',
  },
  {
    id: 'sk-15',
    name: 'Arduino, ESP8266 & STM32',
    category: 'Embedded Hardware',
    stage: 3,
    verified: true,
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z',
  },
  {
    id: 'sk-16',
    name: 'Xilinx Vivado & FreeRTOS',
    category: 'Embedded Hardware',
    stage: 3,
    verified: true,
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z',
  },

  // STAGE 4, THE EXAMINER (STRICTLY EXCLUDED FROM ALL RESUMES)
  {
    id: 'sk-17',
    name: 'Solidity Smart Contracts (Stage 4 Excluded)',
    category: 'Exploratory',
    stage: 4,
    verified: true,
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z',
  },
  {
    id: 'sk-18',
    name: 'Unreal Engine 5 Blueprints (Stage 4 Excluded)',
    category: 'Exploratory',
    stage: 4,
    verified: true,
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z',
  },
  {
    id: 'sk-19',
    name: 'Quantum Qiskit Simulation (Stage 4 Excluded)',
    category: 'Exploratory',
    stage: 4,
    verified: true,
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z',
  },
];

export const INITIAL_LATEX_TEMPLATE_SOURCE = `%-------------------------
% Resume in Latex (Jake's Resume Template — Trusted Base)
%------------------------

\\documentclass[letterpaper,10pt]{article}

\\usepackage{latexsym}
\\usepackage[empty]{fullpage}
\\usepackage{titlesec}
\\usepackage{marvosym}
\\usepackage[usenames,dvipsnames]{color}
\\usepackage{verbatim}
\\usepackage{enumitem}
\\usepackage[hidelinks]{hyperref}
\\usepackage{fancyhdr}
\\usepackage[english]{babel}
\\usepackage{tabularx}
\\input{glyphtounicode}

\\pagestyle{fancy}
\\fancyhf{}
\\fancyfoot{}
\\renewcommand{\\headrulewidth}{0pt}
\\renewcommand{\\footrulewidth}{0pt}

% Adjust margins
\\addtolength{\\oddsidemargin}{-0.5in}
\\addtolength{\\evensidemargin}{-0.5in}
\\addtolength{\\textwidth}{1in}
\\addtolength{\\topmargin}{-0.5in}
\\addtolength{\\textheight}{1.0in}

\\urlstyle{same}
\\raggedbottom
\\raggedright
\\setlength{\\tabcolsep}{0in}

\\titleformat{\\section}{
  \\vspace{-4pt}\\scshape\\raggedright\\large
}{}{0em}{}[\\color{black}\\titlerule \\vspace{-5pt}]

\\pdfgentounicode=1

% Custom commands
\\newcommand{\\resumeItem}[1]{
  \\item\\small{
    {#1 \\vspace{-2pt}}
  }
}

\\newcommand{\\resumeSubheading}[4]{
  \\vspace{-2pt}\\item
    \\begin{tabular*}{0.97\\textwidth}[t]{l@{\\extracolsep{\\fill}}r}
      \\textbf{#1} & #2 \\\\
      \\textit{\\small#3} & \\textit{\\small #4} \\\\
    \\end{tabular*}\\vspace{-7pt}
}

\\newcommand{\\resumeProjectHeading}[2]{
    \\item
    \\begin{tabular*}{0.97\\textwidth}{l@{\\extracolsep{\\fill}}r}
      \\small#1 & #2 \\\\
    \\end{tabular*}\\vspace{-7pt}
}

\\newcommand{\\resumeSubItem}[1]{\\resumeItem{#1}\\vspace{-4pt}}
\\renewcommand\\labelitemii{$\\vcenter{\\hbox{\\tiny$\\bullet$}}$}
\\newcommand{\\resumeSubHeadingListStart}{\\begin{itemize}[leftmargin=0.15in, label={}]}
\\newcommand{\\resumeSubHeadingListEnd}{\\end{itemize}}
\\newcommand{\\resumeItemListStart}{\\begin{itemize}}
\\newcommand{\\resumeItemListEnd}{\\end{itemize}\\vspace{-5pt}}

%-------------------------------------------
%%%%%%  RESUME STARTS HERE  %%%%%%%%%%%%%%%%%%%%%%%%%%%%

\\begin{document}

\\begin{center}
    \\textbf{\\Huge \\scshape %%CANDIDATE_NAME%%} \\\\ \\vspace{1pt}
    \\small %%CANDIDATE_CONTACT%%
\\end{center}

%%RESUME_BODY%%

\\end{document}
`;

export const INITIAL_TEMPLATE: LatexTemplate = {
  id: 'tpl-jakes-standard',
  name: "Jake's Single-Page Engineering Resume (Trusted Template)",
  version: 1,
  latexSource: INITIAL_LATEX_TEMPLATE_SOURCE,
  sectionConfig: {
    showEducation: true,
    showExperience: true,
    showProjects: true,
    showSkills: true,
    showAchievements: true,
    sectionOrder: ['education', 'experience', 'projects', 'skills', 'achievements'],
  },
  spacingConfig: {
    marginInches: 0.5,
    itemSepPt: -2,
    sectionSpacePt: -6,
    maxBulletsPerProject: 3,
    fontSizePt: 10,
  },
  history: [
    {
      version: 1,
      name: "Jake's Single-Page Engineering Resume (v1 Baseline)",
      latexSource: INITIAL_LATEX_TEMPLATE_SOURCE,
      sectionConfig: {
        showEducation: true,
        showExperience: true,
        showProjects: true,
        showSkills: true,
        showAchievements: true,
        sectionOrder: ['education', 'experience', 'projects', 'skills', 'achievements'],
      },
      spacingConfig: {
        marginInches: 0.5,
        itemSepPt: -2,
        sectionSpacePt: -6,
        maxBulletsPerProject: 3,
        fontSizePt: 10,
      },
      savedAt: '2026-10-01T10:00:00.000Z',
      changeNote: 'Initial trusted single-page LaTeX resume template with custom itemize commands.',
    },
  ],
  createdAt: '2026-10-01T10:00:00.000Z',
  updatedAt: '2026-10-01T10:00:00.000Z',
};

export function createInitialSeedResumeVersion(): ResumeVersion {
  const selectedIds = ['proj-churn-analytics', 'proj-mineshield', 'proj-order-matching'];
  const selectedProjects = selectedIds
    .map((id) => INITIAL_PROJECTS.find((p) => p.id === id)!)
    .filter(Boolean);

  const projectBulletsMap: Record<string, string[]> = {};
  for (const p of selectedProjects) {
    projectBulletsMap[p.id] = [...p.defaultBullets];
  }

  const eligibleSkillIds = INITIAL_SKILLS.filter((s) => s.stage !== 4).map((s) => s.id);

  const generatedLatex = generateCompleteLatexResume({
    template: INITIAL_TEMPLATE,
    profile: INITIAL_CANDIDATE_PROFILE,
    selectedProjects,
    projectBulletsMap,
    skills: INITIAL_SKILLS.filter((s) => eligibleSkillIds.includes(s.id)),
    stageConfig: DEFAULT_SKILL_STAGE_CONFIG,
    targetCompany: 'Databricks',
    targetRole: 'Software & ML Systems Engineer',
  });

  const sourceHash = computeSourceHash(generatedLatex);
  const pageFit = calculatePageFitAndSuggestions({
    profile: INITIAL_CANDIDATE_PROFILE,
    selectedProjects,
    manuallyLockedProjectIds: ['proj-churn-analytics', 'proj-mineshield'],
    projectBulletsMap,
    spacingConfig: INITIAL_TEMPLATE.spacingConfig,
    latexSourceOverride: generatedLatex,
  });

  return {
    id: 'res-ver-101',
    userId: 'user-owner-1',
    versionNumber: 1,
    company: 'Databricks',
    role: 'Software & ML Systems Engineer',
    jobDescription: `We are looking for a Software & ML Systems Engineer to build high-throughput data pipelines, distributed backend services, and predictive ML workflows.
Requirements:
- Strong proficiency in Python, Go, Rust, or C++ and production SQL databases.
- Experience designing machine learning pipelines, classification models (scikit-learn, XGBoost), and evaluation metrics (ROC-AUC, precision/recall).
- Experience with real-time telemetry ingestion, Kafka, gRPC, or edge-to-cloud streaming systems.
- Track record of delivering low-latency services and clear analytics dashboards.`,
    roleMode: 'all',
    jobStatus: 'COMPLETED',
    templateId: INITIAL_TEMPLATE.id,
    templateVersion: 1,
    aiRecommendations: [
      {
        projectId: 'proj-churn-analytics',
        rank: 1,
        relevanceScore: 96,
        rationale:
          'Directly satisfies the ML pipeline, classification modeling (scikit-learn, XGBoost), SQL feature engineering, and ROC-AUC evaluation requirements.',
        matchingKeywords: ['machine learning', 'classification', 'ROC-AUC', 'data pipeline'],
        matchingTechnologies: ['Python', 'scikit-learn', 'XGBoost', 'SQL', 'Pandas'],
        supportingEvidence: [
          'Processed 70,000+ customer lifecycle records with automated feature engineering',
          'Evaluated classification models achieving 0.89 ROC-AUC',
        ],
        missingGaps: ['Spark/Delta Lake not explicitly listed in project metrics'],
      },
      {
        projectId: 'proj-order-matching',
        rank: 2,
        relevanceScore: 92,
        rationale:
          'Strong alignment with distributed backend services, Rust/Go concurrency, gRPC, andPostgreSQL event journaling.',
        matchingKeywords: ['distributed systems', 'low latency', 'grpc', 'backend'],
        matchingTechnologies: ['Rust', 'Go', 'gRPC', 'PostgreSQL'],
        supportingEvidence: [
          'Sustained 120,000+ orders/sec with sub-50 microsecond median latency',
        ],
        missingGaps: [],
      },
      {
        projectId: 'proj-mineshield',
        rank: 3,
        relevanceScore: 84,
        rationale:
          'Demonstrates real-time telemetry ingestion, sensor data acquisition, and live threshold alerting dashboard.',
        matchingKeywords: ['wireless telemetry', 'safety monitoring', 'iot'],
        matchingTechnologies: ['Embedded C/C++', 'MQTT', 'React', 'Arduino Uno', 'ESP8266'],
        supportingEvidence: [
          'Implemented real-time C/C++ sensor data acquisition and wireless MQTT/HTTP telemetry streaming',
        ],
        missingGaps: [],
      },
    ],
    selectedProjectIds: selectedIds,
    manuallyLockedProjectIds: ['proj-churn-analytics', 'proj-mineshield'],
    projectBulletsMap,
    bulletSurgeonHistory: {
      'proj-churn-analytics': [
        {
          before:
            'Developed a machine learning pipeline to identify customers at risk of churn using verified project data.',
          after:
            'Developed a machine learning pipeline in Python, scikit-learn, and XGBoost to identify customers at risk of churn across 70,000+ verified lifecycle records.',
          verifiedFactUsed:
            'Processed 70,000+ customer lifecycle records with automated feature engineering in Python, Pandas, and SQL',
          xyzBreakdown: {
            accomplishedX: 'Identified customers at risk of subscription churn',
            measuredByY: '70,000+ verified lifecycle records and 0.89 ROC-AUC validation score',
            byDoingZ: 'engineering an end-to-end Python, scikit-learn, and XGBoost classification pipeline',
          },
        },
      ],
    },
    selectedSkillIds: eligibleSkillIds,
    jobAnalysis: {
      company: 'Databricks',
      role: 'Software & ML Systems Engineer',
      detectedDomain: 'software',
      seniorityLevel: 'New Grad / Early Career Software Engineer (L3/L4)',
      coreRequirements: [
        'Production proficiency in Python, Go, Rust, or C++ and relational SQL',
        'End-to-end ML classification pipelines and empirical evaluation (ROC-AUC, precision/recall)',
        'Low-latency distributed telemetry ingestion (Kafka, gRPC, streaming)',
        'Interactive analytics workflows and observability dashboards',
      ],
      extractedKeywords: [
        'Python',
        'Go',
        'Rust',
        'C++',
        'SQL',
        'scikit-learn',
        'XGBoost',
        'ROC-AUC',
        'Kafka',
        'gRPC',
        'telemetry',
        'distributed systems',
      ],
      confirmedSkillMatches: [
        'Python',
        'Go',
        'Rust',
        'C/C++',
        'SQL (PostgreSQL)',
        'scikit-learn & XGBoost',
        'Apache Kafka & gRPC',
        'React & Next.js',
      ],
      missingRequirements: ['Apache Spark / PySpark cluster tuning'],
      atsScores: [
        {
          platform: 'Workday',
          score: 93,
          evidenceNote:
            'Standard section headings (Education, Experience, Projects, Technical Skills) and exact chronological dates parse with zero field ambiguity.',
        },
        {
          platform: 'Taleo',
          score: 91,
          evidenceNote:
            'High literal keyword density across Python, Rust, Go, SQL, XGBoost, Kafka, and gRPC in both Projects and Technical Skills.',
        },
        {
          platform: 'iCIMS',
          score: 94,
          evidenceNote:
            'Clean single-column LaTeX reading order with normalized role titles and explicit technology tags per project.',
        },
        {
          platform: 'Greenhouse',
          score: 96,
          evidenceNote:
            'High recruiter skim value: quantified impact metrics (45,000 events/sec, 0.89 ROC-AUC, 120,000+ orders/sec) appear in the first clause of bullets.',
        },
        {
          platform: 'Lever',
          score: 95,
          evidenceNote:
            'Direct role alignment between CloudScale Systems internship, Churn Analytics ML pipeline, and ChronosBook matching engine.',
        },
        {
          platform: 'SuccessFactors',
          score: 90,
          evidenceNote:
            'Strong competency mapping across stages 1–3; only minor gap is explicit Apache Spark keyword.',
        },
      ],
      fiveCriticalKeywords: [
        'Python',
        'scikit-learn / XGBoost',
        'Go / Rust',
        'SQL / PostgreSQL',
        'Kafka / gRPC Telemetry',
      ],
      threeRedFlags: [
        'Apache Spark is common in Databricks loops—highlight distributed partitioning concepts from your Kafka/Go ingestion internship.',
        'Ensure hybrid hardware projects (Mineshield) emphasize telemetry streaming and dashboarding when applying to pure cloud software roles.',
        'Graduation date is May 2026—keep full-time availability date explicit in application portal fields.',
      ],
    },
    pageFitAnalysis: pageFit,
    aiGeneratedLatex: generatedLatex,
    savedLatexSource: generatedLatex,
    savedSourceHash: sourceHash,
    isUserEdited: false,
    compiledSourceHash: sourceHash,
    isPdfStale: false,
    compilationResult: {
      success: true,
      compiledAt: '2026-10-20T22:15:00.000Z',
      sourceHash,
      engine: 'pdfTeX 3.141592653-2.6-1.40.25 (TeX Live / LaTeXForge Verified Engine)',
      pageCount: 1,
      isOnePageValid: true,
      extractedText:
        'AARAV MEHTA | University of California, Berkeley | CloudScale Systems | Customer Churn Prediction & Retention Analytics | Mineshield: Smart Mining Safety System | ChronosBook: Low-Latency Limit Order Book',
      missingGlyphs: [],
      unresolvedReferences: [],
      warnings: [],
      errors: [],
      pdfSizeBytes: 48210,
      estimatedLinesUsed: pageFit.estimatedLineCount,
      maxSinglePageLines: pageFit.maxAllowedLineCount,
    },
    auditLog: [
      {
        id: 'aud-1',
        timestamp: '2026-10-20T22:10:00.000Z',
        action: 'DRAFT_CREATED',
        actor: 'user',
        summary: 'Initialized resume version v1 for Databricks — Software & ML Systems Engineer.',
      },
      {
        id: 'aud-2',
        timestamp: '2026-10-20T22:12:00.000Z',
        action: 'MANUAL_PROJECT_SELECTION_UPDATED',
        actor: 'user',
        summary:
          'Locked Customer Churn Prediction & Retention Analytics and Mineshield: Smart Mining Safety System.',
      },
      {
        id: 'aud-3',
        timestamp: '2026-10-20T22:14:00.000Z',
        action: 'LATEX_SAVED',
        actor: 'user',
        summary: 'Saved authoritative LaTeX source to database.',
        sourceHash,
      },
      {
        id: 'aud-4',
        timestamp: '2026-10-20T22:15:00.000Z',
        action: 'PDF_COMPILED',
        actor: 'worker',
        summary: 'Compiled exact saved source hash and verified 1-page PDF output (1 page, 0 errors).',
        sourceHash,
      },
    ],
    createdAt: '2026-10-20T22:10:00.000Z',
    updatedAt: '2026-10-20T22:15:00.000Z',
  };
}

// ============================================================================
// REAL USER #2 SEED DATA: ELENA ROSTOVA (FULL-STACK CLOUD & FINTECH ARCHITECT)
// ============================================================================

export const USER2_CANDIDATE_PROFILE: CandidateProfile = {
  id: 'cand-elena-rostova',
  fullName: 'Elena Rostova',
  email: 'elena.rostova@stanford.edu',
  phone: '+1 (650) 842-9104',
  location: 'Palo Alto, CA',
  linkedinUrl: 'https://linkedin.com/in/elena-rostova',
  githubUrl: 'https://github.com/erostova-dev',
  portfolioUrl: 'https://elenarostova.dev',
  education: [
    {
      id: 'edu-u2-1',
      institution: 'Stanford University',
      degree: 'M.S. in Computer Science (Distributed Systems & Human-Computer Interaction)',
      location: 'Stanford, CA',
      dates: 'Sep. 2024 -- Jun. 2026',
      gpa: '3.96/4.00',
      coursework:
        'Distributed Systems, High-Performance Databases, Cloud Computing, Modern Web Architecture, Applied Cryptography',
    },
  ],
  experience: [
    {
      id: 'exp-u2-1',
      company: 'Stripe',
      role: 'Software Engineering Intern — Global Payouts & Ledger Infrastructure',
      location: 'South San Francisco, CA',
      dates: 'Jun. 2025 -- Sep. 2025',
      bullets: [
        'Architected an idempotent multi-currency settlement reconciliation service in TypeScript, Go, and PostgreSQL processing $45M+ in daily simulated merchant volume with zero double-spend anomalies.',
        'Reduced p99 payment webhook delivery latency from 310ms -> 84ms (>= 72% speedup) by introducing partitioned Redis stream consumers and circuit-breaker backoff queues.',
        'Built real-time financial audit dashboards in React and GraphQL used by 40+ risk operations engineers to inspect cross-border settlement state transitions.',
      ],
    },
    {
      id: 'exp-u2-2',
      company: 'Figma',
      role: 'Product Software Engineering Intern — Multiplayer Canvas Performance',
      location: 'San Francisco, CA',
      dates: 'Jun. 2024 -- Sep. 2024',
      bullets: [
        'Optimized CRDT state synchronization payloads in TypeScript, C++, and WebAssembly, cutting collaborative document load memory by 28% across 10,000+ node design files.',
        'Implemented automated frame-budget regression profiling in CI/CD, catching 14 rendering bottlenecks prior to production release.',
      ],
    },
  ],
  achievements: [
    '1st Place Best FinTech Infrastructure Award — TreeHacks Stanford (1,200+ participants, 2025)',
    'Open-Source Maintainer for LedgerGuard TypeScript SDK (1,900+ GitHub stars)',
    'Stanford Graduate Fellowship in Computer Systems & Cloud Architecture (2024)',
  ],
  calibrationAnswers: {
    targetRoleAndCompanyType:
      'Product & FinTech Infrastructure Software Engineer at high-growth payment, cloud, and AI product companies (Stripe, Plaid, Ramp, Vercel, OpenAI)',
    threeDifferentiators:
      '1. Combines double-entry financial ledger accuracy ($45M+ volume, zero drift) with sub-100ms distributed systems latency.\n2. Deep full-stack fluency spanning TypeScript/React/Next.js frontends down to Go/PostgreSQL/Redis distributed backends.\n3. Proven shipping velocity across Stripe and Figma production systems.',
    headOnAddressing:
      'Completing M.S. CS at Stanford in June 2026; immediately available for full-time SWE roles without relocation constraints in SF Bay Area or NYC.',
    updatedAt: '2026-10-20T18:00:00.000Z',
  },
};

export const USER2_PROJECTS: ProjectItem[] = [
  {
    id: 'proj-u2-ledgersync',
    title: 'LedgerSync: Double-Entry Real-Time Payment Clearing Engine',
    domain: 'software',
    sourceDescription:
      'Built a fault-tolerant double-entry ledger and payment clearing engine in Go, TypeScript, PostgreSQL, and Kafka. Enforces serializable ACID transactions, idempotency keys, and automated reconciliation across multi-region shards.',
    verifiedFacts: [
      'Engineered an ACID-compliant double-entry payment ledger in Go and PostgreSQL handling 18,500+ transactions/sec with strict idempotency keys',
      'Prevented balance drift across $120M+ in synthetic stress-test settlements using serializable snapshot isolation and dead-letter replay queues',
      'Built an interactive React & Tailwind audit console with sub-60ms query response times',
    ],
    defaultBullets: [
      'Engineered an ACID-compliant double-entry payment ledger in Go and PostgreSQL handling 18,500+ transactions/sec with strict idempotency keys.',
      'Prevented balance drift across $120M+ in synthetic stress-test settlements using serializable snapshot isolation and Kafka dead-letter replay queues.',
      'Built an interactive React and TypeScript financial audit console achieving sub-60ms query latency across 5M+ ledger entries.',
    ],
    technologies: ['Go', 'TypeScript', 'PostgreSQL', 'Apache Kafka', 'Redis', 'React'],
    keywords: ['fintech', 'payments', 'distributed ledger', 'idempotency', 'postgresql', 'go'],
    metrics: ['18,500+ tx/sec', '$120M+ simulated volume', 'sub-60ms query latency'],
    githubUrl: 'https://github.com/erostova-dev/ledgersync-engine',
    createdAt: '2026-09-12T10:00:00.000Z',
    updatedAt: '2026-10-15T12:00:00.000Z',
  },
  {
    id: 'proj-u2-collabcanvas',
    title: 'CollabDocs: Local-First CRDT Multiplayer Markdown & Diagram Studio',
    domain: 'software',
    sourceDescription:
      'Developed a real-time collaborative technical specification editor using Yjs CRDTs, WebSockets, IndexedDB offline persistence, and Next.js. Supports 250+ concurrent editors per room with sub-25ms peer sync.',
    verifiedFacts: [
      'Built a local-first multiplayer document and diagram editor in Next.js, TypeScript, and WebSockets supporting 250+ concurrent collaborators',
      'Maintained sub-25ms peer-to-peer delta sync and zero merge conflicts across offline-to-online reconnects via IndexedDB snapshots',
      'Reduced bundle size by 34% using code-split canvas workers and incremental DOM virtualization',
    ],
    defaultBullets: [
      'Built a local-first multiplayer document and diagram editor in Next.js, TypeScript, and WebSockets supporting 250+ concurrent collaborators.',
      'Maintained sub-25ms delta synchronization and zero merge conflicts across offline-to-online reconnects using CRDT state vectors and IndexedDB.',
      'Reduced client memory overhead by 34% via WebWorker offscreen rendering and viewport virtualization.',
    ],
    technologies: ['TypeScript', 'Next.js', 'React', 'WebSockets', 'CRDTs', 'IndexedDB'],
    keywords: ['multiplayer', 'crdt', 'real-time collaboration', 'nextjs', 'websockets', 'frontend'],
    metrics: ['250+ concurrent users', 'sub-25ms delta sync', '34% memory reduction'],
    githubUrl: 'https://github.com/erostova-dev/collabdocs-crdt',
    createdAt: '2026-09-14T10:00:00.000Z',
    updatedAt: '2026-10-15T12:00:00.000Z',
  },
  {
    id: 'proj-u2-pos-terminal',
    title: 'TapFlow: NFC Hardware Point-of-Sale Terminal & Cloud Settlement Bridge',
    domain: 'hybrid',
    sourceDescription:
      'Created a hybrid hardware/software contactless NFC payment terminal using STM32, PN532 NFC controller, TLS 1.3 mutual authentication, and a Node.js/PostgreSQL cloud authorization gateway. No public GitHub repo due to partner NDA.',
    verifiedFacts: [
      'Designed a contactless NFC payment terminal using STM32 and PN532 RF reader with hardware-backed ECDSA transaction signing',
      'Completed end-to-end tap-to-cloud payment authorization in under 420ms over mutually authenticated TLS 1.3 channels',
      'Implemented offline store-and-forward cryptographic receipts with automatic cloud reconciliation upon connectivity restoration',
    ],
    defaultBullets: [
      'Designed a contactless NFC point-of-sale terminal on STM32 and PN532 RF hardware with secure ECDSA cryptographic payload signing.',
      'Completed end-to-end tap-to-cloud payment authorization in under 420ms over mutually authenticated TLS 1.3 channels to a Node.js and PostgreSQL gateway.',
      'Implemented offline store-and-forward encrypted transaction queues with zero data loss during network drops.',
    ],
    technologies: ['STM32', 'C/C++', 'NFC (PN532)', 'Node.js', 'PostgreSQL', 'TLS 1.3'],
    keywords: ['nfc', 'embedded security', 'point of sale', 'fintech hardware', 'tls', 'hybrid'],
    metrics: ['<420ms tap-to-auth', 'ECDSA hardware signing', '0% offline packet loss'],
    githubUrl: '',
    createdAt: '2026-09-18T10:00:00.000Z',
    updatedAt: '2026-10-16T12:00:00.000Z',
  },
  {
    id: 'proj-u2-hft-nic',
    title: 'NetPulse: FPGA TCP/IP Checksum & Packet Filter Offload Engine',
    domain: 'hardware',
    sourceDescription:
      'Implemented a gigabit Ethernet MAC packet parser and IPv4/TCP checksum offload engine in Verilog on Xilinx Artix-7 FPGA.',
    verifiedFacts: [
      'Synthesized a pipelined IPv4/TCP header parser and checksum verifier in Verilog on Xilinx Artix-7 FPGA operating at 156.25 MHz',
      'Achieved 10 Gbps line-rate packet filtering with 38ns deterministic pipeline latency',
    ],
    defaultBullets: [
      'Synthesized a pipelined IPv4/TCP packet parser and hardware checksum offload engine in Verilog on Xilinx Artix-7 FPGA at 156.25 MHz.',
      'Achieved 10 Gbps line-rate ingress filtering with 38ns deterministic pipeline latency verified via Vivado hardware testbenches.',
    ],
    technologies: ['Verilog', 'Xilinx Vivado', 'Artix-7 FPGA', 'TCP/IP Networking'],
    keywords: ['fpga', 'networking', 'verilog', 'hardware offload', 'low latency'],
    metrics: ['10 Gbps line-rate', '38ns latency', '156.25 MHz clock'],
    githubUrl: 'https://github.com/erostova-dev/netpulse-fpga',
    createdAt: '2026-09-20T10:00:00.000Z',
    updatedAt: '2026-10-17T12:00:00.000Z',
  },
];

export const USER2_SKILLS: SkillItem[] = [
  // Stage 1
  { id: 'sk-u2-1', name: 'TypeScript', category: 'Languages', stage: 1 },
  { id: 'sk-u2-2', name: 'Go (Golang)', category: 'Languages', stage: 1 },
  { id: 'sk-u2-3', name: 'Python', category: 'Languages', stage: 1 },
  { id: 'sk-u2-4', name: 'SQL (PostgreSQL)', category: 'Languages', stage: 1 },
  { id: 'sk-u2-5', name: 'C/C++', category: 'Languages', stage: 1 },
  // Stage 2
  { id: 'sk-u2-6', name: 'React & Next.js', category: 'Frameworks', stage: 2 },
  { id: 'sk-u2-7', name: 'Node.js & GraphQL', category: 'Backend', stage: 2 },
  { id: 'sk-u2-8', name: 'Apache Kafka & Redis', category: 'Distributed', stage: 2 },
  { id: 'sk-u2-9', name: 'WebSockets & CRDTs', category: 'Realtime', stage: 2 },
  { id: 'sk-u2-10', name: 'WebAssembly (Wasm)', category: 'Systems', stage: 2 },
  // Stage 3
  { id: 'sk-u2-11', name: 'Docker & Kubernetes', category: 'Cloud', stage: 3 },
  { id: 'sk-u2-12', name: 'AWS (ECS, RDS, KMS)', category: 'Cloud', stage: 3 },
  { id: 'sk-u2-13', name: 'STM32 & NFC (PN532)', category: 'Hardware', stage: 3 },
  { id: 'sk-u2-14', name: 'Verilog & Xilinx Vivado', category: 'Hardware', stage: 3 },
  // Stage 4 — STRICTLY EXCLUDED FROM RESUME
  { id: 'sk-u2-15', name: 'Solidity Smart Contracts', category: 'Excluded', stage: 4 },
  { id: 'sk-u2-16', name: 'Haskell', category: 'Excluded', stage: 4 },
  { id: 'sk-u2-17', name: 'Ruby on Rails', category: 'Excluded', stage: 4 },
];

export function createUser2SeedResumeVersion(): ResumeVersion {
  const selectedIds = ['proj-u2-ledgersync', 'proj-u2-collabcanvas', 'proj-u2-pos-terminal'];
  const selectedProjects = selectedIds
    .map((id) => USER2_PROJECTS.find((p) => p.id === id)!)
    .filter(Boolean);

  const projectBulletsMap: Record<string, string[]> = {};
  for (const p of selectedProjects) {
    projectBulletsMap[p.id] = [...p.defaultBullets];
  }

  const eligibleSkillIds = USER2_SKILLS.filter((s) => s.stage !== 4).map((s) => s.id);

  const generatedLatex = generateCompleteLatexResume({
    template: INITIAL_TEMPLATE,
    profile: USER2_CANDIDATE_PROFILE,
    selectedProjects,
    projectBulletsMap,
    skills: USER2_SKILLS.filter((s) => eligibleSkillIds.includes(s.id)),
    stageConfig: DEFAULT_SKILL_STAGE_CONFIG,
    targetCompany: 'Plaid',
    targetRole: 'Senior FinTech & Distributed Systems Engineer',
  });

  const sourceHash = computeSourceHash(generatedLatex);
  const pageFit = calculatePageFitAndSuggestions({
    profile: USER2_CANDIDATE_PROFILE,
    selectedProjects,
    manuallyLockedProjectIds: ['proj-u2-ledgersync'],
    projectBulletsMap,
    spacingConfig: INITIAL_TEMPLATE.spacingConfig,
    latexSourceOverride: generatedLatex,
  });

  return {
    id: 'res-ver-201',
    userId: 'user-owner-2',
    versionNumber: 1,
    company: 'Plaid',
    role: 'Senior FinTech & Distributed Systems Engineer',
    jobDescription: `Seeking a Senior FinTech & Distributed Systems Engineer to build high-reliability payment clearing APIs, real-time ledger pipelines, and developer consoles.
Requirements:
- Expertise in TypeScript, Go, PostgreSQL, Redis, and event-driven architectures (Kafka).
- Experience with idempotent payment processing, financial data security, and low-latency APIs.
- Track record of building responsive React/Next.js product interfaces.`,
    roleMode: 'all',
    jobStatus: 'COMPLETED',
    templateId: INITIAL_TEMPLATE.id,
    templateVersion: 1,
    aiRecommendations: [
      {
        projectId: 'proj-u2-ledgersync',
        rank: 1,
        relevanceScore: 98,
        rationale:
          'Direct match with Plaid payment clearing, Go/PostgreSQL double-entry ledger accuracy, and Kafka event replay.',
        matchingKeywords: ['fintech', 'payments', 'idempotency', 'postgresql', 'go'],
        matchingTechnologies: ['Go', 'TypeScript', 'PostgreSQL', 'Apache Kafka', 'React'],
        supportingEvidence: [
          '18,500+ transactions/sec with strict idempotency keys',
          'Prevented balance drift across $120M+ in synthetic stress-test settlements',
        ],
        missingGaps: [],
      },
      {
        projectId: 'proj-u2-pos-terminal',
        rank: 2,
        relevanceScore: 89,
        rationale:
          'Demonstrates end-to-end payment authorization security, ECDSA signing, TLS 1.3, and PostgreSQL settlement.',
        matchingKeywords: ['payment authorization', 'tls', 'security'],
        matchingTechnologies: ['Node.js', 'PostgreSQL', 'TLS 1.3', 'C/C++'],
        supportingEvidence: ['Completed end-to-end tap-to-cloud payment authorization in under 420ms'],
        missingGaps: [],
      },
      {
        projectId: 'proj-u2-collabcanvas',
        rank: 3,
        relevanceScore: 85,
        rationale:
          'Highlights deep TypeScript, Next.js, and low-latency real-time state synchronization skills.',
        matchingKeywords: ['real-time', 'nextjs', 'typescript'],
        matchingTechnologies: ['TypeScript', 'Next.js', 'React', 'WebSockets'],
        supportingEvidence: ['Supported 250+ concurrent collaborators with sub-25ms delta sync'],
        missingGaps: [],
      },
    ],
    selectedProjectIds: selectedIds,
    manuallyLockedProjectIds: ['proj-u2-ledgersync'],
    projectBulletsMap,
    bulletSurgeonHistory: {},
    selectedSkillIds: eligibleSkillIds,
    jobAnalysis: {
      company: 'Plaid',
      role: 'Senior FinTech & Distributed Systems Engineer',
      detectedDomain: 'software',
      seniorityLevel: 'Senior / L4-L5 Software Engineer',
      coreRequirements: [
        'High-reliability payment clearing APIs in Go and TypeScript',
        'ACID ledger design in PostgreSQL and Redis stream processing',
        'Responsive React & Next.js financial developer consoles',
      ],
      extractedKeywords: [
        'TypeScript',
        'Go',
        'PostgreSQL',
        'Redis',
        'Kafka',
        'Idempotency',
        'React',
        'Next.js',
        'Payments',
      ],
      confirmedSkillMatches: [
        'TypeScript',
        'Go (Golang)',
        'SQL (PostgreSQL)',
        'Apache Kafka & Redis',
        'React & Next.js',
        'Node.js & GraphQL',
      ],
      missingRequirements: ['gRPC service mesh configuration'],
      atsScores: [
        {
          platform: 'Greenhouse',
          score: 97,
          evidenceNote: 'Stripe internship + LedgerSync project directly match FinTech ledger criteria.',
        },
        {
          platform: 'Lever',
          score: 95,
          evidenceNote: 'Strong quantified impact metrics ($45M+ daily volume, 18,500+ tx/sec).',
        },
        {
          platform: 'Workday',
          score: 94,
          evidenceNote: 'Clean single-column hierarchy and exact chronological date formatting.',
        },
        {
          platform: 'iCIMS',
          score: 93,
          evidenceNote: 'High keyword alignment across TypeScript, Go, PostgreSQL, Kafka, and Redis.',
        },
        {
          platform: 'Taleo',
          score: 92,
          evidenceNote: 'All core FinTech and distributed systems competencies explicitly matched.',
        },
        {
          platform: 'SuccessFactors',
          score: 94,
          evidenceNote: 'Zero Stage 4 skill leakage; verified Stanford M.S. CS credentials.',
        },
      ],
      fiveCriticalKeywords: ['TypeScript', 'Go (Golang)', 'PostgreSQL', 'Kafka / Redis', 'Payments / Ledger'],
      threeRedFlags: [
        'TapFlow POS project has no public GitHub link—keep the architecture metrics self-explanatory in the bullets.',
        'Emphasize production scale from Stripe Payouts internship in the top third of the page.',
        'Confirm June 2026 Stanford graduation timeline in initial recruiter screen.',
      ],
    },
    pageFitAnalysis: pageFit,
    aiGeneratedLatex: generatedLatex,
    savedLatexSource: generatedLatex,
    savedSourceHash: sourceHash,
    isUserEdited: false,
    compiledSourceHash: sourceHash,
    isPdfStale: false,
    auditLog: [
      {
        id: 'aud-u2-1',
        timestamp: '2026-10-20T22:20:00.000Z',
        action: 'DRAFT_CREATED',
        actor: 'user',
        summary: 'Initialized resume version v1 for Plaid — Senior FinTech & Distributed Systems Engineer.',
      },
    ],
    createdAt: '2026-10-20T22:20:00.000Z',
    updatedAt: '2026-10-20T22:20:00.000Z',
  };
}

