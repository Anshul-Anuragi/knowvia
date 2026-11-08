export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  subscription_tier: "free" | "pro" | "max" | "team" | "business" | string;
  subscription_status: string;
}

export interface Token {
  access_token: string;
  token_type: string;
}

export interface Conversation {
  id: string;
  title: string;
  user_id: string;
  created_at?: string;
}

export interface ToolStep {
  tool: string;
  query?: string;
  status: string;
  output?: string;
  filename?: string;
  error?: string;
}

export interface Message {
  id?: string;
  conversation_id?: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at?: string;
  sources?: Source[];
  is_research_report?: boolean;
  report_filename?: string;
  report_path?: string;
  tool_steps?: ToolStep[];
}

export interface Source {
  chunk_id?: string;
  citation_index?: number;
  document_id: string;
  document_name: string;
  page_number: number;
  file_size: string;
  extracted_text: string;
  validated_sentences: string[];
  confidence_score: number;
  is_verified: boolean;
  score: number;
}

export interface SourceGuide {
  summary: string;
  key_topics: string[];
  suggested_questions: string[];
}

export interface ChunkMapItem {
  chunk_id?: string;
  page_number: number;
  char_start?: number;
  char_end?: number;
  preview: string;
}

export interface DocumentContentResponse {
  id: string;
  filename: string;
  full_markdown: string;
  source_guide: SourceGuide;
  chunk_map: Record<string, ChunkMapItem>;
  supabase_md_url?: string | null;
}

export interface ChatRequest {
  conversation_id: string;
  question: string;
  mode?: "rag" | "research" | "deep_research";
  model?: string;
  document_ids?: string[];
}

export interface ChatResponse {
  answer: string;
  sources: Source[];
}

export interface DocumentItem {
  id: string;
  filename: string;
  uploaded_by: string;
  file_size?: string;
  storage_provider?: "supabase" | "aws_s3" | "cloud" | "local" | string;
  created_at?: string;
}

export interface MindMapNode {
  id: string;
  parent_id: string | null;
  label: string;
  summary?: string;
  level: number;
  page_numbers?: number[];
  source_ids?: string[];
  can_expand_more?: boolean;
}

export interface MindMapResponse {
  id: string;
  title: string;
  document_ids: string[];
  nodes: MindMapNode[];
  cache_hit: boolean;
  cache_source?: "redis" | "postgres" | "generated" | string;
  created_at?: string;
  updated_at?: string;
}

export interface MindMapGenerateRequest {
  document_ids?: string[];
  selected_text?: string;
  topic_title?: string;
  force_regenerate?: boolean;
}

export interface MindMapExpandRequest {
  mindmap_id: string;
  node_id: string;
}

export interface ResearchRunRequest {
  query: string;
  conversation_id?: string;
  selected_documents?: string[];
}

export interface ResearchRunResponse {
  answer: string;
  report_filename: string;
  report_path: string;
  tool_steps: ToolStep[];
  sources: Source[];
  conversation_id: string;
}

export interface ReportItem {
  title: string;
  filename: string;
  word_count: number;
  size_bytes: number;
  created_at: string;
}

export interface PlanLimits {
  max_documents: number;
  max_file_size_mb: number;
  max_daily_queries: number;
  advanced_retrieval: boolean;
  priority_support: boolean;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  category: "individual" | "team_enterprise";
  tagline: string;
  monthly_price: number;
  yearly_price: number;
  currency: string;
  is_custom_price: boolean;
  price_prefix?: string | null;
  recommended: boolean;
  commitment_note?: string | null;
  feature_heading?: string | null;
  features: string[];
  limits: PlanLimits;
}

export interface UserSubscription {
  plan_id: string;
  tier: string;
  status: string;
  billing_cycle: "monthly" | "yearly";
  renews_at?: string;
  is_active: boolean;
  limits: PlanLimits;
}

export interface CheckoutRequest {
  plan_id: string;
  billing_cycle?: "monthly" | "yearly";
}

export interface CheckoutResponse {
  checkout_url?: string;
  session_id?: string;
  status: string;
  message?: string;
}

export interface ContactSalesRequest {
  name: string;
  email: string;
  company_name: string;
  team_size: string;
  message?: string;
}

export interface ContactSalesResponse {
  status: string;
  message: string;
  inquiry_id: string;
}

export interface HealthCheckResponse {
  status: string;
  database?: string;
  service?: string;
  version?: string;
  environment?: string;
}

