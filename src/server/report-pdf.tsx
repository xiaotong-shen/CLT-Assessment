/**
 * Standalone PDF generation for the placement report.
 *
 * Decoupled from the website's DOM/print styles: the document is authored here
 * as an explicit component tree with a fixed A4 layout and deterministic
 * pagination, rendered to a true vector PDF via @react-pdf/renderer.
 *
 * Type: lightly-serif headings (PT Serif, bundled) over a clean sans body, to
 * match the app's light, neutral design direction.
 */
import path from "path";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
  renderToBuffer,
} from "@react-pdf/renderer";
import type { Recommendation, Flag, Strand } from "@/engine/types";
import {
  STRAND_LABELS,
  levelBandLabel,
  candoDescription,
} from "@/lib/level-descriptions";

// ---------------------------------------------------------------------------
// Fonts — bundled PT Serif for headings (Helvetica remains available for body)
// ---------------------------------------------------------------------------
const FONT_DIR = path.join(process.cwd(), "src/server/fonts");
Font.register({
  family: "PT Serif",
  fonts: [
    { src: path.join(FONT_DIR, "PTSerif-Regular.ttf") },
    { src: path.join(FONT_DIR, "PTSerif-Bold.ttf"), fontWeight: "bold" },
    { src: path.join(FONT_DIR, "PTSerif-Italic.ttf"), fontStyle: "italic" },
  ],
});
const SERIF = "PT Serif";
const SANS = "Helvetica";

// ---------------------------------------------------------------------------
// Palette — blue accent on warm neutral, per the design direction
// ---------------------------------------------------------------------------
const C = {
  ink: "#22201B",
  muted: "#6B6759",
  dim: "#9A9686",
  accent: "#2563EB",
  accentDeep: "#1E40AF",
  hair: "#E6E2D8",
  barTrack: "#ECEAE1",
  panel: "#FAF9F5",
  flagBg: "#FCF6E8",
  flagBorder: "#E6D3A3",
  flagInk: "#7A5F22",
};

const MAX_LEVEL = 6;

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const st = StyleSheet.create({
  page: {
    paddingTop: 48,
    paddingBottom: 56,
    paddingHorizontal: 54,
    fontFamily: SANS,
    fontSize: 11,
    color: C.ink,
    lineHeight: 1.5,
  },

  eyebrow: {
    fontFamily: SANS,
    fontSize: 8.5,
    letterSpacing: 1.5,
    color: C.dim,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  studentName: { fontFamily: SERIF, fontWeight: "bold", fontSize: 24, lineHeight: 1.1, color: C.ink },
  assessedDate: { fontSize: 10, color: C.muted, marginTop: 6 },
  placeLabel: { fontSize: 8.5, color: C.dim, textAlign: "right", marginBottom: 3 },
  course: { fontFamily: SERIF, fontWeight: "bold", fontSize: 28, lineHeight: 1.05, color: C.accentDeep, textAlign: "right" },
  stream: { fontSize: 10, color: C.muted, textAlign: "right" },
  rule: { borderBottomWidth: 1.5, borderBottomColor: C.ink, marginTop: 16, marginBottom: 20 },

  intro: { fontSize: 10.5, color: C.muted, marginBottom: 22, lineHeight: 1.5 },

  sectionTitle: { fontFamily: SERIF, fontWeight: "bold", fontSize: 14, color: C.ink, marginBottom: 14 },

  block: { marginBottom: 22 },

  // Strand rows
  strandRow: { marginBottom: 15 },
  strandTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 },
  strandName: { fontFamily: SANS, fontSize: 12.5, color: C.ink },
  strandLevel: { fontFamily: SERIF, fontWeight: "bold", fontSize: 13, color: C.accentDeep },
  barTrack: { height: 7, backgroundColor: C.barTrack, borderRadius: 4 },
  barFill: { height: 7, backgroundColor: C.accent, borderRadius: 4 },
  band: { fontSize: 9, color: C.dim, marginTop: 5, textTransform: "uppercase", letterSpacing: 0.5 },
  cando: { fontSize: 10.5, color: C.muted, marginTop: 2, lineHeight: 1.45 },

  // Flags
  flagPanel: { backgroundColor: C.flagBg, borderWidth: 1, borderColor: C.flagBorder, borderRadius: 6, padding: 14 },
  flagTitle: { fontFamily: SANS, fontSize: 11.5, color: C.flagInk, marginBottom: 9 },
  flagItem: { marginBottom: 8 },
  flagLabel: { fontFamily: SANS, fontSize: 10.5, color: C.flagInk },
  flagNote: { fontSize: 9.5, color: C.flagInk, marginTop: 1 },

  footnote: { fontSize: 9, color: C.dim, marginTop: 4, fontStyle: "italic" },

  footer: {
    position: "absolute",
    bottom: 26,
    left: 54,
    right: 54,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 0.75,
    borderTopColor: C.hair,
    paddingTop: 7,
    fontSize: 8,
    color: C.dim,
  },
});

const FLAG_LABELS: Record<string, { label: string; note: string }> = {
  "uneven-profile": {
    label: "Uneven language profile",
    note: "Levels vary significantly across skills. A teacher review is recommended to understand the student's specific strengths and gaps.",
  },
  "stage-3-ambiguous": {
    label: "Borderline placement",
    note: "The results place the student close to a boundary between two levels. A specialist review is advised.",
  },
  rushed: {
    label: "Short response times",
    note: "Several answers were submitted very quickly. Consider whether the student engaged fully with the questions.",
  },
  "rapid-clicks": {
    label: "Rapid answer selection",
    note: "Multiple-choice answers were selected unusually fast, so these results may not be reliable.",
  },
  "writing-blank": {
    label: "Writing not completed",
    note: "The writing task was not submitted, so the writing level could not be assessed.",
  },
  "audio-skipped": {
    label: "Listening not completed",
    note: "Listening items were skipped, so the listening level may be underestimated.",
  },
};

// ---------------------------------------------------------------------------
// Document
// ---------------------------------------------------------------------------
export interface ReportPdfData {
  rec: Recommendation;
  studentName: string;
  assessmentDate: Date;
  /** Which strands were actually assessed. Others are omitted from the report. */
  assessedStrands?: Strand[];
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" });
}

function ReportDocument({ rec, studentName, assessmentDate, assessedStrands }: ReportPdfData) {
  const warnFlags = rec.flags.filter(
    (f: Flag) => f.severity === "warn" || f.severity === "review"
  );

  const allStrands = Object.entries(rec.perStrandLevel) as [Strand, number][];
  const strands = assessedStrands
    ? allStrands.filter(([s]) => assessedStrands.includes(s))
    : allStrands;

  return (
    <Document title={`Placement Report — ${studentName}`} author="CLT Assessment Platform">
      <Page size="A4" style={st.page}>
        {/* Header */}
        <View>
          <Text style={st.eyebrow}>ESL Placement Assessment · Confidential</Text>
          <View style={st.headerRow}>
            <View>
              <Text style={st.studentName}>{studentName}</Text>
              <Text style={st.assessedDate}>Assessed {formatDate(assessmentDate)}</Text>
            </View>
            <View>
              <Text style={st.placeLabel}>Recommended Placement</Text>
              <Text style={st.course}>{rec.course}</Text>
              <Text style={st.stream}>{rec.stream} stream</Text>
            </View>
          </View>
        </View>
        <View style={st.rule} />

        <Text style={st.intro}>
          This report summarizes the student&rsquo;s estimated English level in each skill
          area assessed. Levels run from 1 (Beginning) to 6 (Mainstream-ready) and are
          estimates from an adaptive placement test.
        </Text>

        {/* Skills profile — plain per-strand levels + descriptions */}
        <View style={st.block}>
          <Text style={st.sectionTitle}>Language Skills</Text>
          {strands.map(([strand, level]) => (
            <View style={st.strandRow} key={strand} wrap={false}>
              <View style={st.strandTop}>
                <Text style={st.strandName}>{STRAND_LABELS[strand] ?? strand}</Text>
                <Text style={st.strandLevel}>Level {level}</Text>
              </View>
              <View style={st.barTrack}>
                <View style={[st.barFill, { width: `${(level / MAX_LEVEL) * 100}%` }]} />
              </View>
              <Text style={st.band}>{levelBandLabel(level)}</Text>
              <Text style={st.cando}>{candoDescription(strand, level)}</Text>
            </View>
          ))}
        </View>

        {/* Flags */}
        {warnFlags.length > 0 && (
          <View style={st.block} wrap={false}>
            <View style={st.flagPanel}>
              <Text style={st.flagTitle}>Teacher review recommended</Text>
              {warnFlags.map((f, i) => {
                const info = FLAG_LABELS[f.code];
                return (
                  <View style={st.flagItem} key={i}>
                    <Text style={st.flagLabel}>{info?.label ?? f.code}</Text>
                    <Text style={st.flagNote}>{info?.note ?? f.detail}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Footer (fixed on every page) */}
        <View style={st.footer} fixed>
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
