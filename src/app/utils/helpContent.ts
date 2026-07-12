export interface HelpResource {
  id: string;
  title: string;
  url: string;
}

export interface HelpFaq {
  id: string;
  question: string;
  answer: string;
}

export interface HelpContent {
  resources: HelpResource[];
  faqs: HelpFaq[];
}
