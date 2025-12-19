import RuleExtractor from "@/components/rules/rule-extractor";

export default function RulesPage() {
  return (
    <div className="animate-in fade-in-50">
      <div className="mb-6">
        <h2 className="text-2xl font-headline font-semibold">League Rule Extraction</h2>
        <p className="text-muted-foreground">Use AI to extract and summarize key rules from a document.</p>
      </div>
      <RuleExtractor />
    </div>
  );
}
