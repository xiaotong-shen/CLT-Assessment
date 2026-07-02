/**
 * Standalone PDF generation for the placement report.
 *
 * This is intentionally decoupled from the website's DOM/print styles: the
 * document is authored here as an explicit component tree with a fixed A4
 * layout, controlled margins, and deterministic pagination. Rendered to a
 * true vector PDF via @react-pdf/renderer — no headless browser, no
 * window.print(), nothing gets clipped by the live layout.
 *
 * Fonts: uses the PDF-standard families (Times-Roman for headings to give a
 * lightly-serif feel, Helvetica for body) so there are no font files to ship.
 */
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import type { Recommendation, Flag, Strand } from "@/engine/types";

// ---------------------------------------------------------------------------
// Palette (blue accent on neutral, per the project's design direction)
// ---------------------------------------------------------------------------
const COLORS = {
  ink: "#1A1916",
  muted: "#6B6759",
  dim: "#9A9686",
  accent: "#2563EB", // blue
  accentDeep: "#1E40AF",
  hair: "#E4E1D8",
  barTrack: "#ECEAE2",
  panel: "#FAF9F5",
  flagBg: "#FCF6E8",
  flagBorder: "#E6D3A3",
  flagInk: "#8A6D2C",
};

// ---------------------------------------------------------------------------
// Static copy (mirrors the on-screen report)
// ---------------------------------------------------------------------------
const STRAND_LABELS: Record<Strand, string> = {
  reading: "Reading",
  listening: "Listening",
  grammar: "Grammar / Language Structures",
  writing: "Writing",
};

const LEVEL_DESCRIPTORS: Record<number, string> = {
  1: "Beginning (STEP 1–2) — Communicates using isolated words and simple phrases",
  2: "Developing (STEP 2–3) — Produces simple sentences with support",
  3: "Expanding (STEP 3–4) — Communicates in simple and some complex sentences",
  4: "Consolidating (STEP 4–5) — Uses varied sentence structures with increasing accuracy",
  5: "Bridging (STEP 5–6) — Approaches grade-level language proficiency",
  6: "Mainstream-ready (STEP 6) — Grade-level proficiency; no ESL support required",
};

const FLAG_LABELS: Record<string, { label: string; note: string }> = {
  "uneven-profile": {
    label: "Uneven Language Profile",
    note: "Scores vary significantly across strands. Human review recommended to understand skill gaps.",
  },
  "stage-3-ambiguous": {
    label: "Borderline Placement",
    note: "Results place the student near a boundary between levels. Specialist review is advised.",
  },
  rushed: {
    label: "Short Response Times",
    note: "Several responses were submitted very quickly. Consider whether this student was able to engage fully.",
  },
  "rapid-clicks": {
    label: "Rapid Answer Selection",
    note: "Multiple-choice responses were selected unusually fast. Results may not be reliable.",
  },
  "writing-blank": {
    label: "Writing Not Completed",
    note: "The writing task was not submitted or was submitted without content. Writing level could not be assessed.",
  },
  "audio-skipped": {
    label: "Listening Task Not Completed",
    note: "Audio items were skipped or answered immediately. Listening level may be underestimated.",
  },
};

const MAX_LEVEL = 6;

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const s = StyleSheet.create({
  page: {
    paddingTop: 46,
    paddingBottom: 54,
    paddingHorizontal: 52,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: COLORS.ink,
    lineHeight: 1.45,
  },
  // Header
  eyebrow: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    letterSpacing: 1.6,
    color: COLORS.dim,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  studentName: { fontFamily: "Times-Bold", fontSize: 22, lineHeight: 1.1, color: COLORS.ink },
  assessedDate: { fontSize: 9, color: COLORS.muted, marginTop: 5 },
  placeLabel: { fontSize: 8, color: COLORS.dim, textAlign: "right", marginBottom: 2 },
  course: { fontFamily: "Times-Bold", fontSize: 26, lineHeight: 1.1, color: COLORS.accentDeep, textAlign: "right" },
  stream: { fontSize: 9, color: COLORS.muted, textAlign: "right", textTransform: "capitalize" },
  rule: { borderBottomWidth: 1.5, borderBottomColor: COLORS.ink, marginTop: 14, marginBottom: 18 },

  // Sections
  sectionTitle: {
    fontFamily: "Times-Bold",
    fontSize: 12,
    color: COLORS.ink,
    marginBottom: 8,
  },
  panel: {
    backgroundColor: COLORS.panel,
    borderWidth: 1,
    borderColor: COLORS.hair,
    borderRadius: 5,
    padding: 12,
  },
  summaryItem: { flexDirection: "row", marginBottom: 2 },
  bullet: { width: 10, color: COLORS.accent },
  summaryText: { flex: 1, fontSize: 9.5, color: COLORS.muted },

  block: { marginBottom: 20 },

  // Strand rows
  strandRow: { marginBottom: 12 },
  strandTop: { flexDirection: "row", justifyContent: "space-between", marginBottom: 3 },
  strandName: { fontFamily: "Helvetica-Bold", fontSize: 10.5, color: COLORS.ink },
  strandLevel: { fontFamily: "Helvetica-Bold", fontSize: 10.5, color: COLORS.accentDeep },
  barTrack: { height: 6, backgroundColor: COLORS.barTrack, borderRadius: 3 },
  barFill: { height: 6, backgroundColor: COLORS.accent, borderRadius: 3 },
  descriptor: { fontSize: 8, color: COLORS.dim, marginTop: 3 },

  // Flags
  flagPanel: {
    backgroundColor: COLORS.flagBg,
    borderWidth: 1,
    borderColor: COLORS.flagBorder,
    borderRadius: 5,
    padding: 12,
  },
  flagTitle: { fontFamily: "Helvetica-Bold", fontSize: 10.5, color: COLORS.flagInk, marginBottom: 8 },
  flagItem: { marginBottom: 7 },
  flagLabel: { fontFamily: "Helvetica-Bold", fontSize: 9.5, color: COLORS.flagInk },
  flagNote: { fontSize: 8.5, color: COLORS.flagInk },

  // Footer
  footer: {
    position: "absolute",
    bottom: 24,
    left: 52,
    right: 52,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 0.75,
    borderTopColor: COLORS.hair,
    paddingTop: 6,
    fontSize: 7.5,
    color: COLORS.dim,
  },
});

// ---------------------------------------------------------------------------
// Document
// ---------------------------------------------------------------------------
export interface ReportPdfData {
  rec: Recommendation;
  studentName: string;
  assessmentDate: Date;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" });
}

/** Replace glyphs the standard PDF fonts lack (e.g. → arrows) with supported ones. */
function sanitize(text: string): string {
  return text.replace(/→+/g, " — ").replace(/\s{2,}/g, " ").trim();
}

function ReportDocument({ rec, studentName, assessmentDate }: ReportPdfData) {
  const warnFlags = rec.flags.filter(
    (f: Flag) => f.severity === "warn" || f.severity === "review"
  );
  const reasoning = (rec.reasoning ?? []).slice(0, 6);
  const strands = Object.entries(rec.perStrandLevel) as [Strand, number][];

  return (
    <Document
      title={`Placement Report — ${studentName}`}
      author="CLT Assessment Platform"
    >
      <Page size="A4" style={s.page}>
        {/* Header */}
        <View>
          <Text style={s.eyebrow}>ESL Placement Assessment · Confidential</Text>
          <View style={s.headerRow}>
            <View>
              <Text style={s.studentName}>{studentName}</Text>
              <Text style={s.assessedDate}>Assessed: {formatDate(assessmentDate)}</Text>
            </View>
            <View>
              <Text style={s.placeLabel}>Recommended Placement</Text>
              <Text style={s.course}>{rec.course}</Text>
              <Text style={s.stream}>{rec.stream}</Text>
            </View>
          </View>
        </View>
        <View style={s.rule} />

        {/* Assessment summary */}
        {reasoning.length > 0 && (
          <View style={s.block}>
            <Text style={s.sectionTitle}>Assessment Summary</Text>
            <View style={s.panel}>
              {reasoning.map((line, i) => (
                <View style={s.summaryItem} key={i}>
                  <Text style={s.bullet}>•</Text>
                  <Text style={s.summaryText}>{sanitize(line)}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Language skills profile */}
        <View style={s.block}>
          <Text style={s.sectionTitle}>Language Skills Profile</Text>
          {strands.map(([strand, level]) => (
            <View style={s.strandRow} key={strand} wrap={false}>
              <View style={s.strandTop}>
                <Text style={s.strandName}>{STRAND_LABELS[strand] ?? strand}</Text>
                <Text style={s.strandLevel}>Level {level}</Text>
              </View>
              <View style={s.barTrack}>
                <View style={[s.barFill, { width: `${(level / MAX_LEVEL) * 100}%` }]} />
              </View>
              <Text style={s.descriptor}>
                {LEVEL_DESCRIPTORS[level] ?? `Level ${level}`}
              </Text>
            </View>
          ))}
        </View>

        {/* Flags */}
        {warnFlags.length > 0 && (
          <View style={s.block} wrap={false}>
            <View style={s.flagPanel}>
              <Text style={s.flagTitle}>Specialist Review Recommended</Text>
              {warnFlags.map((f, i) => {
                const info = FLAG_LABELS[f.code];
                return (
                  <View style={s.flagItem} key={i}>
                    <Text style={s.flagLabel}>{info?.label ?? f.code}</Text>
                    <Text style={s.flagNote}>{info?.note ?? f.detail}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Footer (fixed on every page) */}
        <View style={s.footer} fixed>
          <Text>CLT Assessment Platform · Engine {rec.engineVersion}</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

/** Render the placement report to a PDF buffer. */
export async function renderReportPdf(data: ReportPdfData): Promise<Buffer> {
  return renderToBuffer(<ReportDocument {...data} />);
}
