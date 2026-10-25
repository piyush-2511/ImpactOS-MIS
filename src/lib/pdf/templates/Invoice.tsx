/* eslint-disable react/jsx-no-literals -- PDF content: every label arrives translated in `labels`; only separators and codes (GSTIN, PAN, IFSC) are literal. */
import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import { pdfFont } from '../fonts';

export type InvoicePdfProps = {
  locale: 'en' | 'hi';
  payee: {
    name: string;
    address: string;
    gstin?: string;
    upi?: string;
    bankName?: string;
    account?: string;
    ifsc?: string;
  };
  billTo: { name: string; state: string; pan?: string | null };
  number: string;
  issued: string;
  due: string;
  period: string;
  lines: { description: string; quantity: number; amount: string }[];
  subtotal: string;
  credit: string | null;
  gst: string | null;
  gstLabel: string;
  total: string;
  qrDataUrl?: string | null;
  labels: Record<
    | 'invoice'
    | 'billTo'
    | 'number'
    | 'issued'
    | 'due'
    | 'period'
    | 'item'
    | 'qty'
    | 'amount'
    | 'subtotal'
    | 'credit'
    | 'total'
    | 'pay'
    | 'upi'
    | 'bank'
    | 'reference'
    | 'fc'
    | 'utr',
    string
  >;
};

const s = StyleSheet.create({
  page: { padding: 36, fontSize: 9.5, color: '#062746' },
  row: { flexDirection: 'row' },
  between: { flexDirection: 'row', justifyContent: 'space-between' },
  h1: { fontSize: 20, fontWeight: 600, marginBottom: 4 },
  muted: { color: '#44566A' },
  box: { borderWidth: 0.6, borderColor: '#CBD5DF', borderRadius: 4, padding: 10 },
  th: { backgroundColor: '#F1F4F7', fontWeight: 600 },
  cell: { paddingVertical: 5, paddingHorizontal: 6 },
  line: { borderBottomWidth: 0.5, borderBottomColor: '#E6ECF1' },
  total: { fontSize: 12, fontWeight: 600 },
  qr: { width: 104, height: 104 },
});

/** ImpactOS invoice (platform → NGO). Amounts are pre-formatted strings; numbers are fixed once issued. */
export function InvoicePdf(p: InvoicePdfProps) {
  const L = p.labels;
  return (
    <Document title={`${L.invoice} ${p.number}`} author={p.payee.name} creator="ImpactOS" language={p.locale}>
      <Page size="A4" style={[s.page, { fontFamily: pdfFont(p.locale) }]}>
        <View style={[s.between, { marginBottom: 18 }]}>
          <View>
            <Text style={s.h1}>{p.payee.name}</Text>
            <Text style={s.muted}>{p.payee.address}</Text>
            {p.payee.gstin ? <Text style={s.muted}>{`GSTIN ${p.payee.gstin}`}</Text> : null}
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={s.h1}>{L.invoice}</Text>
            <Text>{`${L.number}: ${p.number}`}</Text>
            <Text>{`${L.issued}: ${p.issued}`}</Text>
            <Text style={{ fontWeight: 600 }}>{`${L.due}: ${p.due}`}</Text>
          </View>
        </View>
        <View style={[s.box, { marginBottom: 14 }]}>
          <Text style={[s.muted, { marginBottom: 2 }]}>{L.billTo}</Text>
          <Text style={{ fontWeight: 600 }}>{p.billTo.name}</Text>
          <Text>{p.billTo.state}</Text>
          {p.billTo.pan ? <Text>{`PAN ${p.billTo.pan}`}</Text> : null}
          <Text style={[s.muted, { marginTop: 4 }]}>{`${L.period}: ${p.period}`}</Text>
        </View>
        <View style={[s.row, s.th]}>
          <Text style={[s.cell, { flex: 5 }]}>{L.item}</Text>
          <Text style={[s.cell, { flex: 1, textAlign: 'right' }]}>{L.qty}</Text>
          <Text style={[s.cell, { flex: 2, textAlign: 'right' }]}>{L.amount}</Text>
        </View>
        {p.lines.map((l, i) => (
          <View key={i} style={[s.row, s.line]} wrap={false}>
            <Text style={[s.cell, { flex: 5 }]}>{l.description}</Text>
            <Text style={[s.cell, { flex: 1, textAlign: 'right' }]}>{String(l.quantity)}</Text>
            <Text style={[s.cell, { flex: 2, textAlign: 'right' }]}>{l.amount}</Text>
          </View>
        ))}
        <View style={{ alignSelf: 'flex-end', width: 220, marginTop: 8 }}>
          <View style={s.between}>
            <Text>{L.subtotal}</Text>
            <Text>{p.subtotal}</Text>
          </View>
          {p.credit ? (
            <View style={s.between}>
              <Text>{L.credit}</Text>
              <Text>{p.credit}</Text>
            </View>
          ) : null}
          {p.gst ? (
            <View style={s.between}>
              <Text>{p.gstLabel}</Text>
              <Text>{p.gst}</Text>
            </View>
          ) : null}
          <View style={[s.between, { marginTop: 4, borderTopWidth: 1, borderTopColor: '#062746', paddingTop: 4 }]}>
            <Text style={s.total}>{L.total}</Text>
            <Text style={s.total}>{p.total}</Text>
          </View>
        </View>
        <View style={[s.box, s.row, { marginTop: 20, gap: 14 }]} wrap={false}>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          {p.qrDataUrl ? <Image style={s.qr} src={p.qrDataUrl} /> : null}
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ fontWeight: 600, marginBottom: 2 }}>{L.pay}</Text>
            {p.payee.upi ? <Text>{`${L.upi}: ${p.payee.upi}`}</Text> : null}
            {p.payee.account ? (
              <Text>{`${L.bank}: ${p.payee.bankName ?? ''} · ${p.payee.account} · IFSC ${p.payee.ifsc ?? ''}`}</Text>
            ) : null}
            <Text>{`${L.reference}: ${p.number}`}</Text>
            <Text style={s.muted}>{L.utr}</Text>
            <Text style={{ color: '#7A4A00', marginTop: 4 }}>{L.fc}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
