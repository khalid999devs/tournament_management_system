import type { CSSProperties } from "react";
import {
  Body,
  Button,
  Column,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Row,
  Section,
  Text,
} from "react-email";

export type EmailTone = "pending" | "success" | "attention" | "info";

export type TransactionalEmailProps = {
  preview: string;
  eyebrow: string;
  title: string;
  status: string;
  tone: EmailTone;
  greeting: string;
  paragraphs: string[];
  details?: { label: string; value: string }[];
  notice?: string;
  action?: { label: string; href: string };
  reference?: string;
  supportEmail: string;
};

const palette = {
  navy: "#0d1b39",
  deepNavy: "#071127",
  gold: "#e4c27a",
  ivory: "#f6f1e6",
  paper: "#fbfaf6",
  ink: "#17284d",
  muted: "#59657a",
  line: "#e2e4e8",
};

const tones: Record<EmailTone, { color: string; surface: string }> = {
  pending: { color: "#91681e", surface: "#fff5df" },
  success: { color: "#117348", surface: "#e8f6ed" },
  attention: { color: "#a43c37", surface: "#fff0ed" },
  info: { color: "#285a91", surface: "#eaf2fb" },
};

export function TransactionalEmail({
  preview,
  eyebrow,
  title,
  status,
  tone,
  greeting,
  paragraphs,
  details,
  notice,
  action,
  reference,
  supportEmail,
}: TransactionalEmailProps) {
  const accent = tones[tone];

  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={body}>
        <Container style={outer}>
          <Section style={header}>
            <Text style={brandKicker}>
              NOTRE DAME COLLEGE ASSOCIATION OF KUET
            </Text>
            <Row>
              <Column style={brandMark}>∞</Column>
              <Column style={brandName}>NDCAK</Column>
            </Row>
            <Text style={headerCaption}>INDOOR GAMES CHAMPIONSHIP</Text>
          </Section>

          <Section style={content}>
            <Text style={eyebrowStyle}>{eyebrow}</Text>
            <Heading as="h1" style={heading}>
              {title}
            </Heading>
            <Text
              style={{
                ...statusStyle,
                color: accent.color,
                backgroundColor: accent.surface,
              }}
            >
              {status}
            </Text>

            <Text style={greetingStyle}>{greeting}</Text>
            {paragraphs.map((paragraph, index) => (
              <Text key={index} style={paragraphStyle}>
                {paragraph}
              </Text>
            ))}

            {details && details.length > 0 ? (
              <Section style={detailsBox}>
                <Text style={detailsHeading}>YOUR DETAILS</Text>
                {details.map(({ label, value }) => (
                  <Row key={label} style={detailRow}>
                    <Column style={detailLabel}>{label}</Column>
                    <Column style={detailValue}>{value}</Column>
                  </Row>
                ))}
              </Section>
            ) : null}

            {notice ? <Text style={noticeStyle}>{notice}</Text> : null}

            {action ? (
              <Button href={action.href} style={actionButton}>
                {action.label} →
              </Button>
            ) : null}

            <Hr style={divider} />
            <Text style={helpText}>
              Need help? Reply to this email or contact{" "}
              <Link href={`mailto:${supportEmail}`} style={helpLink}>
                {supportEmail}
              </Link>
              .
            </Text>
          </Section>

          <Section style={footer}>
            <Text style={footerBrand}>NDCAK · BUILT FOR THE GAME</Text>
            <Text style={footerText}>
              This is an event operations message from Notre Dame College
              Association of KUET.
            </Text>
            {reference ? (
              <Text style={footerReference}>Reference: {reference}</Text>
            ) : null}
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const body: CSSProperties = {
  margin: 0,
  padding: "32px 12px",
  backgroundColor: "#edf0f1",
  color: palette.ink,
  fontFamily: "Arial, Helvetica, sans-serif",
};

const outer: CSSProperties = {
  width: "100%",
  maxWidth: "600px",
  margin: "0 auto",
  backgroundColor: palette.paper,
};

const header: CSSProperties = {
  padding: "27px 34px 24px",
  backgroundColor: palette.navy,
  borderTop: `5px solid ${palette.gold}`,
};

const brandKicker: CSSProperties = {
  margin: "0 0 12px",
  color: "#c7cedb",
  fontSize: "10px",
  fontWeight: 700,
  letterSpacing: "1.5px",
};

const brandMark: CSSProperties = {
  width: "54px",
  color: palette.gold,
  fontSize: "42px",
  fontWeight: 700,
  lineHeight: "46px",
};

const brandName: CSSProperties = {
  color: palette.ivory,
  fontSize: "34px",
  fontWeight: 800,
  letterSpacing: "1px",
  lineHeight: "46px",
};

const headerCaption: CSSProperties = {
  margin: "5px 0 0",
  color: palette.gold,
  fontSize: "11px",
  fontWeight: 700,
  letterSpacing: "2px",
};

const content: CSSProperties = { padding: "36px 34px 30px" };

const eyebrowStyle: CSSProperties = {
  margin: "0 0 8px",
  color: "#8a6934",
  fontSize: "11px",
  fontWeight: 700,
  letterSpacing: "2px",
  textTransform: "uppercase",
};

const heading: CSSProperties = {
  margin: "0 0 16px",
  color: palette.deepNavy,
  fontSize: "32px",
  fontWeight: 800,
  lineHeight: "1.15",
};

const statusStyle: CSSProperties = {
  display: "inline-block",
  margin: "0 0 28px",
  padding: "8px 12px",
  borderRadius: "3px",
  fontSize: "12px",
  fontWeight: 700,
  letterSpacing: "0.5px",
  textTransform: "uppercase",
};

const greetingStyle: CSSProperties = {
  margin: "0 0 13px",
  color: palette.ink,
  fontSize: "16px",
  fontWeight: 700,
  lineHeight: "1.5",
};

const paragraphStyle: CSSProperties = {
  margin: "0 0 15px",
  color: "#37445a",
  fontSize: "15px",
  lineHeight: "1.65",
};

const detailsBox: CSSProperties = {
  margin: "24px 0",
  padding: "18px 20px 8px",
  backgroundColor: "#f1f3f4",
  borderLeft: `3px solid ${palette.gold}`,
};

const detailsHeading: CSSProperties = {
  margin: "0 0 10px",
  color: palette.muted,
  fontSize: "10px",
  fontWeight: 700,
  letterSpacing: "1.5px",
};

const detailRow: CSSProperties = {
  borderTop: `1px solid ${palette.line}`,
};

const detailLabel: CSSProperties = {
  width: "36%",
  padding: "10px 8px 10px 0",
  color: palette.muted,
  fontSize: "12px",
  lineHeight: "1.4",
};

const detailValue: CSSProperties = {
  padding: "10px 0",
  color: palette.ink,
  fontSize: "13px",
  fontWeight: 700,
  lineHeight: "1.4",
  textAlign: "right",
  overflowWrap: "anywhere",
};

const noticeStyle: CSSProperties = {
  margin: "20px 0",
  padding: "13px 16px",
  color: "#574626",
  backgroundColor: "#fff8e8",
  fontSize: "13px",
  lineHeight: "1.55",
};

const actionButton: CSSProperties = {
  display: "inline-block",
  margin: "9px 0 4px",
  padding: "14px 21px",
  borderRadius: "3px",
  backgroundColor: palette.navy,
  color: palette.ivory,
  fontSize: "13px",
  fontWeight: 700,
  textDecoration: "none",
};

const divider: CSSProperties = {
  margin: "30px 0 20px",
  borderColor: palette.line,
};

const helpText: CSSProperties = {
  margin: 0,
  color: palette.muted,
  fontSize: "12px",
  lineHeight: "1.6",
};

const helpLink: CSSProperties = {
  color: palette.ink,
  textDecoration: "underline",
};

const footer: CSSProperties = {
  padding: "22px 34px 26px",
  backgroundColor: palette.deepNavy,
};

const footerBrand: CSSProperties = {
  margin: "0 0 6px",
  color: palette.gold,
  fontSize: "11px",
  fontWeight: 700,
  letterSpacing: "1.2px",
};

const footerText: CSSProperties = {
  margin: 0,
  color: "#b2bdcf",
  fontSize: "11px",
  lineHeight: "1.55",
};

const footerReference: CSSProperties = {
  margin: "12px 0 0",
  color: "#b2bdcf",
  fontSize: "11px",
};
