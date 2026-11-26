import { LegalPage } from "@/components/legal/LegalPage";
import { privacyPolicy as doc } from "@/content/legal";
import { pageMetadata } from "@/lib/metadata";

// Content and the record of every change from the live page: src/content/legal.ts.
export const metadata = pageMetadata({ title: doc.title, description: doc.description, path: doc.path });

export default function Page() {
  return <LegalPage doc={doc} />;
}
