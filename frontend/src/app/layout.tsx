import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { ChatProvider } from "@/context/ChatContext";

export const metadata: Metadata = {
  title: "Knowvia Enterprise RAG | Knowledge Intelligence",
  description:
    "Enterprise Retrieval-Augmented Generation platform with dense vector search, Gemini 1.5 synthesis, and verified grounding attribution.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#060919] text-slate-100 antialiased overflow-hidden selection:bg-indigo-500/30 selection:text-white">
        <AuthProvider>
          <ChatProvider>{children}</ChatProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
