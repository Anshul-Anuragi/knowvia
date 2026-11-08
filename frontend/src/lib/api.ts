import {
  User,
  Token,
  Conversation,
  Message,
  ChatRequest,
  ChatResponse,
  DocumentItem,
  DocumentContentResponse,
  SubscriptionPlan,
  UserSubscription,
  CheckoutRequest,
  CheckoutResponse,
  ContactSalesRequest,
  ContactSalesResponse,
  HealthCheckResponse,
  MindMapResponse,
  MindMapGenerateRequest,
  MindMapExpandRequest,
  ResearchRunRequest,
  ResearchRunResponse,
  ReportItem,
} from "@/types/api";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

class ApiClient {
  private getHeaders(isFormData = false): HeadersInit {
    const headers: Record<string, string> = {};
    if (!isFormData) {
      headers["Content-Type"] = "application/json";
    }

    if (typeof window !== "undefined") {
      const token = localStorage.getItem("knowvia_token");
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
    }

    return headers;
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      let errorMessage = `HTTP Error ${response.status}: ${response.statusText}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.detail || errorData.message || errorMessage;
      } catch {
        // use default error message
      }
      throw new Error(errorMessage);
    }
    return response.json();
  }

  // ==========================================
  // 1. Authentication & User Profile (/users/*)
  // ==========================================
  async register(data: { name: string; email: string; password: string }): Promise<User> {
    const res = await fetch(`${API_BASE_URL}/users/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return this.handleResponse<User>(res);
  }

  async login(data: { email: string; password: string }): Promise<Token> {
    const res = await fetch(`${API_BASE_URL}/users/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const tokenData = await this.handleResponse<Token>(res);
    if (typeof window !== "undefined" && tokenData.access_token) {
      localStorage.setItem("knowvia_token", tokenData.access_token);
    }
    return tokenData;
  }

  async getMe(): Promise<User> {
    const res = await fetch(`${API_BASE_URL}/users/me`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse<User>(res);
  }

  async getAdminDashboard(): Promise<{ message: string }> {
    const res = await fetch(`${API_BASE_URL}/users/admin`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse<{ message: string }>(res);
  }

  logout(): void {
    if (typeof window !== "undefined") {
      localStorage.removeItem("knowvia_token");
      localStorage.removeItem("knowvia_user");
    }
  }

  // ==========================================
  // 2. Conversations Management (/conversations/*)
  // ==========================================
  async getConversations(): Promise<Conversation[]> {
    const res = await fetch(`${API_BASE_URL}/conversations/`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse<Conversation[]>(res);
  }

  async createConversation(): Promise<Conversation> {
    const res = await fetch(`${API_BASE_URL}/conversations/`, {
      method: "POST",
      headers: this.getHeaders(),
    });
    return this.handleResponse<Conversation>(res);
  }

  async getConversationMessages(conversationId: string): Promise<Message[]> {
    const res = await fetch(
      `${API_BASE_URL}/conversations/${conversationId}/messages`,
      {
        headers: this.getHeaders(),
      }
    );
    return this.handleResponse<Message[]>(res);
  }

  async deleteConversation(
    conversationId: string
  ): Promise<{ message: string; conversation_id: string }> {
    const res = await fetch(`${API_BASE_URL}/conversations/${conversationId}`, {
      method: "DELETE",
      headers: this.getHeaders(),
    });
    return this.handleResponse<{ message: string; conversation_id: string }>(res);
  }

  // ==========================================
  // 3. RAG Chat & Question Answering (/chat/*)
  // ==========================================
  async askQuestion(payload: ChatRequest): Promise<ChatResponse> {
    const res = await fetch(`${API_BASE_URL}/chat/ask`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });
    return this.handleResponse<ChatResponse>(res);
  }

  // ==========================================
  // 4. Documents & Knowledge Base (/documents/*)
  // ==========================================
  async getDocuments(): Promise<DocumentItem[]> {
    const res = await fetch(`${API_BASE_URL}/documents/`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse<DocumentItem[]>(res);
  }

  async uploadDocument(
    file: File
  ): Promise<{ message: string; document_id: string }> {
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(`${API_BASE_URL}/documents/upload`, {
      method: "POST",
      headers: this.getHeaders(true),
      body: formData,
    });
    return this.handleResponse<{ message: string; document_id: string }>(res);
  }

  async deleteDocument(
    documentId: string
  ): Promise<{ message: string; document_id: string }> {
    const res = await fetch(`${API_BASE_URL}/documents/${documentId}`, {
      method: "DELETE",
      headers: this.getHeaders(),
    });
    return this.handleResponse<{ message: string; document_id: string }>(res);
  }

  async getDocumentContent(
    documentId: string
  ): Promise<DocumentContentResponse> {
    const res = await fetch(`${API_BASE_URL}/documents/${documentId}/content`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse<DocumentContentResponse>(res);
  }

  // ==========================================
  // 5. Subscriptions & Upgrade Flow (/subscriptions/*)
  // ==========================================
  async getSubscriptionPlans(): Promise<{ plans: SubscriptionPlan[] }> {
    const res = await fetch(`${API_BASE_URL}/subscriptions/plans`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse<{ plans: SubscriptionPlan[] }>(res);
  }

  async getMySubscription(): Promise<UserSubscription> {
    const res = await fetch(`${API_BASE_URL}/subscriptions/me`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse<UserSubscription>(res);
  }

  async checkoutSubscription(
    payload: CheckoutRequest
  ): Promise<CheckoutResponse> {
    const res = await fetch(`${API_BASE_URL}/subscriptions/checkout`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });
    return this.handleResponse<CheckoutResponse>(res);
  }

  async contactSales(
    payload: ContactSalesRequest
  ): Promise<ContactSalesResponse> {
    const res = await fetch(`${API_BASE_URL}/subscriptions/contact-sales`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });
    return this.handleResponse<ContactSalesResponse>(res);
  }

  // ==========================================
  // 6. Mind Map Engine (/mindmap/*)
  // ==========================================
  async generateMindMap(
    data: MindMapGenerateRequest
  ): Promise<MindMapResponse> {
    const res = await fetch(`${API_BASE_URL}/mindmap/generate`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return this.handleResponse<MindMapResponse>(res);
  }

  async getMindMap(mindmapId: string): Promise<MindMapResponse> {
    const res = await fetch(`${API_BASE_URL}/mindmap/${mindmapId}`, {
      method: "GET",
      headers: this.getHeaders(),
    });
    return this.handleResponse<MindMapResponse>(res);
  }

  async expandMindMapNode(
    data: MindMapExpandRequest
  ): Promise<MindMapResponse> {
    const res = await fetch(`${API_BASE_URL}/mindmap/expand`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return this.handleResponse<MindMapResponse>(res);
  }

  async deleteMindMap(
    mindmapId: string
  ): Promise<{ status: string; id: string; message: string }> {
    const res = await fetch(`${API_BASE_URL}/mindmap/${mindmapId}`, {
      method: "DELETE",
      headers: this.getHeaders(),
    });
    return this.handleResponse<{ status: string; id: string; message: string }>(res);
  }

  // ==========================================
  // 7. LangGraph Research Agent (/research/*)
  // ==========================================
  async runResearch(
    data: ResearchRunRequest
  ): Promise<ResearchRunResponse> {
    const res = await fetch(`${API_BASE_URL}/research/run`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return this.handleResponse<ResearchRunResponse>(res);
  }

  async getReports(): Promise<ReportItem[]> {
    const res = await fetch(`${API_BASE_URL}/research/reports`, {
      method: "GET",
      headers: this.getHeaders(),
    });
    return this.handleResponse<ReportItem[]>(res);
  }

  getReportDownloadUrl(filename: string): string {
    const safeName = encodeURIComponent(filename);
    return `${API_BASE_URL}/research/reports/${safeName}/download`;
  }

  // ==========================================
  // 8. System Health Probes (/healthz, /readyz)
  // ==========================================
  async checkReadiness(): Promise<HealthCheckResponse> {
    const res = await fetch(`${API_BASE_URL}/readyz`);
    return this.handleResponse<HealthCheckResponse>(res);
  }

  async checkLiveness(): Promise<HealthCheckResponse> {
    const res = await fetch(`${API_BASE_URL}/healthz`);
    return this.handleResponse<HealthCheckResponse>(res);
  }

  async checkRoot(): Promise<HealthCheckResponse> {
    const res = await fetch(`${API_BASE_URL}/`);
    return this.handleResponse<HealthCheckResponse>(res);
  }
}

export const api = new ApiClient();

