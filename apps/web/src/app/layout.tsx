import type { Metadata } from "next";
import "./globals.css";
import { TopNav } from "../components/top-nav";

export const metadata: Metadata = {
  title: "Kapasitet i helsesektoren",
  description: "Oversikt over kapasitet, behov og scenarioer i norsk helsesektor"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nb">
      <body>
        <header className="header">
          <div className="container">
            <strong>Kapasitet i helsesektoren</strong>
            <TopNav />
          </div>
        </header>
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
