export interface TextToPdfRequest {
  text: string;
  config?: {
    fontFamily?: "Helvetica" | "Courier" | "TimesRoman";
    fontSize?: number;
    lineSpacing?: number;
    marginTop?: number;
    marginRight?: number;
    marginBottom?: number;
    marginLeft?: number;
    pageSize?: "A4" | "Letter" | "Legal";
    orientation?: "portrait" | "landscape";
    textColor?: string;
    backgroundColor?: string;
    headerText?: string;
    footerText?: string;
    showPageNumbers?: boolean;
    alignment?: "left" | "center" | "right";
  };
}

export interface HtmlToPdfRequest {
  html: string;
  config?: {
    pageSize?: "A4" | "Letter" | "Legal";
    orientation?: "portrait" | "landscape";
    marginTop?: number;
    marginRight?: number;
    marginBottom?: number;
    marginLeft?: number;
    headerText?: string;
    footerText?: string;
  };
}

export interface MarkdownToPdfRequest {
  markdown: string;
  theme?: "light" | "dark" | "github";
  config?: {
    pageSize?: "A4" | "Letter" | "Legal";
    orientation?: "portrait" | "landscape";
    marginTop?: number;
    marginRight?: number;
    marginBottom?: number;
    marginLeft?: number;
    headerText?: string;
    footerText?: string;
  };
}

export interface ReportRequest {
  title?: string;
  subtitle?: string;
  headers: string[];
  rows: (string | number)[][];
  summary?: {
    label: string;
    value: string | number;
    style?: "normal" | "positive" | "negative" | "bold";
  }[];
  config?: {
    pageSize?: "A4" | "Letter" | "Legal";
    orientation?: "portrait" | "landscape";
    marginTop?: number;
    marginRight?: number;
    marginBottom?: number;
    marginLeft?: number;
    headerText?: string;
    footerText?: string;
    currency?: string;
    locale?: string;
    tableHeaderColor?: string;
    accentColor?: string;
  };
}

export interface CompressConfig {
  algorithm?: "condense" | "photon";
  removeMetadata?: boolean;
  removeThumbnails?: boolean;
  removeUnusedObjects?: boolean;
  subsetFonts?: boolean;
  dpi?: 72 | 96 | 150 | 300;
  greyscale?: boolean;
  jpegQuality?: number;
}
